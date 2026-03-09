import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatSessions, chatMessages, agents } from "@paperclipai/db";
import type { ChatStreamEvent } from "@paperclipai/shared";
import {
  buildPaperclipEnv,
  ensurePathInEnv,
  stripPackageManagerEnv,
  parseJson,
  asString,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import { notFound, unprocessable } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";
import { mcpServerService } from "./mcp-servers.js";
import { skillService } from "./skills.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PAPERCLIP_SKILLS_CANDIDATES = [
  path.resolve(__moduleDir, "../../node_modules/@paperclipai/adapter-claude-local/skills"),
  path.resolve(__moduleDir, "../../../packages/adapters/claude-local/skills"),
  path.resolve(__moduleDir, "../../../skills"),
];

async function resolvePaperclipSkillsDir(): Promise<string | null> {
  for (const candidate of PAPERCLIP_SKILLS_CANDIDATES) {
    const isDir = await fs.stat(candidate).then((s) => s.isDirectory()).catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}

async function buildSkillsDir(
  externalSkills?: Array<{ slug: string; skillMdUrl: string | null; skillMdContent?: string | null }>,
): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-chat-skills-"));
  const target = path.join(tmp, ".claude", "skills");
  await fs.mkdir(target, { recursive: true });
  const skillsDir = await resolvePaperclipSkillsDir();
  if (skillsDir) {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fs.symlink(path.join(skillsDir, entry.name), path.join(target, entry.name));
      }
    }
  }

  if (externalSkills?.length) {
    for (const skill of externalSkills) {
      try {
        let content: string | null = null;
        if (skill.skillMdContent) {
          content = skill.skillMdContent;
        } else if (skill.skillMdUrl) {
          const resp = await fetch(skill.skillMdUrl);
          if (!resp.ok) continue;
          content = await resp.text();
        }
        if (!content) continue;
        const skillDir = path.join(target, skill.slug);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, "SKILL.md"), content, "utf-8");
      } catch {
        console.warn("[chat-skills] Failed to load external skill %s", skill.slug);
      }
    }
  }

  return tmp;
}

export function chatService(db: Db) {
  const mcpSvc = mcpServerService(db);
  async function getAgent(agentId: string) {
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
    if (!agent) throw notFound("Agent not found");
    return agent;
  }

  return {
    createSession: async (companyId: string, agentId: string, createdByUserId: string | null) => {
      const agent = await getAgent(agentId);
      if (agent.companyId !== companyId) throw unprocessable("Agent does not belong to this company");
      if (agent.reportsTo !== null) throw unprocessable("Chat is only available for top-level agents");

      const session = await db
        .insert(chatSessions)
        .values({ companyId, agentId, createdByUserId, source: "web" })
        .returning()
        .then((rows) => rows[0]);
      return session;
    },

    listSessions: async (companyId: string, agentId?: string, status?: string) => {
      const conditions = [eq(chatSessions.companyId, companyId)];
      if (agentId) conditions.push(eq(chatSessions.agentId, agentId));
      if (status) conditions.push(eq(chatSessions.status, status));
      return db
        .select()
        .from(chatSessions)
        .where(and(...conditions))
        .orderBy(desc(chatSessions.updatedAt));
    },

    getSession: async (sessionId: string) => {
      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .then((rows) => rows[0] ?? null);
      if (!session) throw notFound("Chat session not found");

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      return { ...session, messages };
    },

    archiveSession: async (sessionId: string) => {
      return db
        .update(chatSessions)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    sendMessage: async (
      sessionId: string,
      content: string,
      onStream: (event: ChatStreamEvent) => void,
      imagePaths?: string[],
    ) => {
      // 1. Load session
      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId))
        .then((rows) => rows[0] ?? null);
      if (!session) throw notFound("Chat session not found");

      // 2. Persist user message
      const userMsg = await db
        .insert(chatMessages)
        .values({ sessionId, role: "user", content })
        .returning()
        .then((rows) => rows[0]);

      // 3. Load agent
      const agent = await getAgent(session.agentId);
      const config = (agent.adapterConfig ?? {}) as Record<string, unknown>;
      const model = asString(config.model, "");
      const dangerouslySkipPermissions = config.dangerouslySkipPermissions === true;

      // 4. Build skills dir (including external skills), MCP config, and system prompt
      const skillSvc = skillService(db);
      const externalSkills = await skillSvc.buildSkillUrlsForAgent(session.agentId);
      const skillsDir = await buildSkillsDir(externalSkills);

      // Build MCP config for agent's assigned servers
      const mcpConfig = await mcpSvc.buildMcpConfig(session.agentId);
      const mcpServersMap = mcpConfig
        ? ((mcpConfig as Record<string, unknown>).mcpServers as Record<string, unknown> ?? {})
        : {};
      const mcpServerNames = Object.keys(mcpServersMap);

      // Build MCP tool lines for system prompt
      const mcpPromptLines: string[] = [];
      if (mcpServerNames.length > 0) {
        mcpPromptLines.push(
          "",
          "# Connected MCP Servers",
          "The following MCP servers are connected. Their tools are DIRECTLY AVAILABLE — call them without ToolSearch.",
          ...mcpServerNames.map((n) => `- ${n}: tools prefixed with mcp__${n}__ (e.g. mcp__${n}__browser_navigate)`),
        );
      }

      const systemPromptFile = path.join(skillsDir, "chat-persona.md");
      const systemPrompt = [
        `You are ${agent.name}${agent.title ? `, ${agent.title}` : ""} (${agent.role}).`,
        agent.capabilities ? `Your capabilities: ${agent.capabilities}` : "",
        "",
        "You are in an interactive chat session with a board member.",
        "Help them brainstorm, plan, and create work items (issues, goals, projects).",
        "Use the Paperclip skill tools to create, list, and manage work items.",
        "Be collaborative and confirm before making changes.",
        "",
        `Company ID: ${agent.companyId}`,
        `Agent ID: ${agent.id}`,
        ...mcpPromptLines,
      ]
        .filter(Boolean)
        .join("\n");
      await fs.writeFile(systemPromptFile, systemPrompt, "utf-8");

      // 5. Build Claude CLI args
      const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
      if (session.claudeSessionId) args.push("--resume", session.claudeSessionId);
      if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (model) args.push("--model", model);
      args.push("--append-system-prompt-file", systemPromptFile);
      args.push("--add-dir", skillsDir);

      // 6. Build env (including API auth token so agent can call Paperclip API)
      const env: Record<string, string> = {
        ...buildPaperclipEnv({ id: agent.id, companyId: agent.companyId }),
      };
      const authToken = createLocalAgentJwt(agent.id, agent.companyId, "claude-local", sessionId);
      if (authToken) {
        env.PAPERCLIP_API_KEY = authToken;
      }
      const envConfig = parseObject(config.env);
      for (const [key, value] of Object.entries(envConfig)) {
        if (typeof value === "string") env[key] = value;
      }
      const mergedEnv = ensurePathInEnv(stripPackageManagerEnv({ ...process.env, ...env })) as Record<string, string>;

      // Debug: log any remaining npm/pnpm env vars
      const leakedVars = Object.keys(mergedEnv).filter((k) => k.startsWith("npm_") || k.startsWith("PNPM_") || k === "NODE_PATH");
      if (leakedVars.length > 0) {
        console.warn("[chat] WARNING: leaked package manager env vars:", leakedVars.join(", "));
      } else {
        console.log("[chat] env clean: no npm_*/PNPM_*/NODE_PATH vars");
      }

      // 7. Resolve working directory
      const cwd = asString(config.cwd, "") || process.cwd();

      // Write MCP config to skillsDir (isolated per session) and pass via --mcp-config
      // Avoids polluting the shared cwd which causes cross-agent MCP leakage
      if (mcpServerNames.length > 0 && mcpConfig) {
        const mcpConfigPath = path.join(skillsDir, "mcp.json");
        const mcpJson = JSON.stringify(mcpConfig, null, 2);
        await fs.writeFile(mcpConfigPath, mcpJson, "utf-8");
        args.push("--mcp-config", mcpConfigPath);
        console.log("[chat] mcp.json written to %s: %s", mcpConfigPath, mcpJson);
      }

      // 8. Spawn Claude CLI
      const command = asString(config.command, "claude");
      console.log("[chat] spawning: %s (cwd: %s) args: %s", command, cwd, args.join(" "));
      const child = spawn(command, args, {
        cwd,
        env: mergedEnv,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Copy images into skillsDir so they're accessible via --add-dir, then build the prompt
      const imageRefs: string[] = [];
      if (imagePaths?.length) {
        const imgDir = path.join(skillsDir, "images");
        await fs.mkdir(imgDir, { recursive: true });
        for (const imgPath of imagePaths) {
          const filename = path.basename(imgPath);
          const dest = path.join(imgDir, filename);
          await fs.copyFile(imgPath, dest);
          imageRefs.push(dest);
        }
      }

      // Write user message as stdin prompt (with image references if any)
      let prompt = content;
      if (imageRefs.length > 0) {
        const refs = imageRefs.map((p) => `![image](${p})`).join("\n");
        prompt = `${content}\n\n${refs}`;
      }
      child.stdin.write(prompt);
      child.stdin.end();

      let streamedText = "";  // Text already streamed to client
      let resultText = "";     // Final text from result event (authoritative)
      let newSessionId: string | null = null;
      let detectedModel = "";
      let buffer = "";

      const processEvent = (event: Record<string, unknown>) => {
        const type = asString(event.type, "");
        const subtype = asString(event.subtype, "");

        if (type === "system" && subtype === "init") {
          newSessionId = asString(event.session_id, newSessionId ?? "") || newSessionId;
          detectedModel = asString(event.model, detectedModel);
          if (Array.isArray(event.mcp_servers)) {
            for (const s of event.mcp_servers as Array<Record<string, unknown>>) {
              const name = asString(s.name, "?");
              const status = asString(s.status, "?");
              const error = asString(s.error, "");
              console.log("[chat] MCP server %s: status=%s%s", name, status, error ? ` error=${error}` : "");
            }
          }
          if (Array.isArray(event.tools)) {
            const mcpTools = (event.tools as string[]).filter((t) => t.startsWith("mcp__playwright"));
            console.log("[chat] Playwright tools loaded: %d", mcpTools.length);
          }
          return;
        }

        if (type === "assistant") {
          newSessionId = asString(event.session_id, newSessionId ?? "") || newSessionId;
          const message = parseObject(event.message);
          const contentBlocks = Array.isArray(message.content) ? message.content : [];
          for (const block of contentBlocks) {
            if (typeof block !== "object" || block === null || Array.isArray(block)) continue;
            const b = block as Record<string, unknown>;
            const blockType = asString(b.type, "");
            if (blockType === "text") {
              const text = asString(b.text, "");
              if (text) {
                streamedText += text;
                onStream({ type: "content_delta", content: text });
              }
            }
            if (blockType === "tool_use") {
              onStream({
                type: "tool_use",
                toolName: asString(b.name, "unknown"),
                toolInput: parseObject(b.input),
              });
            }
          }
          return;
        }

        if (type === "content_block_delta") {
          const delta = parseObject(event.delta);
          if (asString(delta.type, "") === "text_delta") {
            const text = asString(delta.text, "");
            if (text) {
              streamedText += text;
              onStream({ type: "content_delta", content: text });
            }
          }
          return;
        }

        if (type === "result") {
          newSessionId = asString(event.session_id, newSessionId ?? "") || newSessionId;
          resultText = asString(event.result, "");
          // Stream any text from result that wasn't already streamed via deltas
          if (resultText && resultText !== streamedText) {
            const alreadySent = streamedText.trim();
            const fullResult = resultText.trim();
            if (!alreadySent) {
              onStream({ type: "content_delta", content: resultText });
              streamedText = resultText;
            } else if (!fullResult.startsWith(alreadySent)) {
              onStream({ type: "content_delta", content: "\n\n" + resultText });
              streamedText += "\n\n" + resultText;
            } else if (fullResult.length > alreadySent.length) {
              const remainder = resultText.slice(streamedText.length);
              if (remainder.trim()) {
                onStream({ type: "content_delta", content: remainder });
                streamedText += remainder;
              }
            }
          }
        }
      };

      return new Promise<void>((resolve, reject) => {
        child.stdout?.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const parsed = parseJson(line);
            if (!parsed) continue;
            processEvent(parsed);
          }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          if (text.trim()) {
            console.warn("[chat] claude stderr:", text.trim());
          }
        });

        child.on("error", (err) => {
          fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
          onStream({ type: "error", error: err.message });
          reject(err);
        });

        child.on("close", async (code) => {
          console.log("[chat] exited code=%s streamed=%d result=%d buffer=%d", code, streamedText.length, resultText.length, buffer.length);
          // Process remaining buffer
          if (buffer.trim()) {
            const parsed = parseJson(buffer.trim());
            if (parsed) processEvent(parsed);
          }

          // Use result text (authoritative) or fall back to streamed text
          const assistantText = resultText || streamedText;

          try {
            // Persist assistant message
            if (assistantText) {
              const assistantMsg = await db
                .insert(chatMessages)
                .values({
                  sessionId,
                  role: "assistant",
                  content: assistantText,
                  metadata: {
                    model: detectedModel || model || null,
                    exitCode: code,
                  },
                })
                .returning()
                .then((rows) => rows[0]);

              onStream({ type: "message_complete", messageId: assistantMsg.id });

              // Publish live event
              publishLiveEvent({
                companyId: session.companyId,
                type: "chat.message",
                payload: {
                  sessionId,
                  agentId: session.agentId,
                  messageId: assistantMsg.id,
                  role: "assistant",
                },
              });
            }

            // Update session with claude session ID
            const updateData: Record<string, unknown> = { updatedAt: new Date() };
            if (newSessionId) updateData.claudeSessionId = newSessionId;
            if (!session.title && assistantText) {
              updateData.title = content.slice(0, 100);
            }
            await db
              .update(chatSessions)
              .set(updateData)
              .where(eq(chatSessions.id, sessionId));
          } catch (err) {
            onStream({
              type: "error",
              error: err instanceof Error ? err.message : "Failed to save response",
            });
          } finally {
            fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
            resolve();
          }
        });
      });
    },

    activeSessionsByAgent: async (companyId: string) => {
      const rows = await db
        .select({
          agentId: chatSessions.agentId,
          count: count(),
        })
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.companyId, companyId),
            eq(chatSessions.status, "active"),
          ),
        )
        .groupBy(chatSessions.agentId);
      return rows;
    },

    findOrCreateTelegramSession: async (agentId: string, telegramChatId: string) => {
      const agent = await getAgent(agentId);

      // Try to find existing active session for this telegram chat
      const existing = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.agentId, agentId),
            eq(chatSessions.telegramChatId, telegramChatId),
            eq(chatSessions.status, "active"),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) return existing;

      // Create new session
      return db
        .insert(chatSessions)
        .values({
          companyId: agent.companyId,
          agentId,
          source: "telegram",
          telegramChatId,
          status: "active",
        })
        .returning()
        .then((rows) => rows[0]);
    },
  };
}
