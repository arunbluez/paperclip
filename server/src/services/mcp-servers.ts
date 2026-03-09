import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { mcpServers, agentMcpServers } from "@paperclipai/db";
import type { CreateMcpServer, UpdateMcpServer } from "@paperclipai/shared";
import { stripPackageManagerEnv, ensurePathInEnv } from "@paperclipai/adapter-utils/server-utils";

const BROWSER_PROFILES_BASE = path.join(os.homedir(), ".paperclip", "browser-profiles");

/**
 * Managed MCP SSE server processes.
 * stdio MCP servers fail when Claude CLI is spawned from Node.js (known bug).
 * Workaround: start them as SSE servers and connect via HTTP instead.
 */
const managedServers = new Map<string, { process: ChildProcess; port: number; url: string }>();

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * Start an MCP server as an SSE server and return its URL.
 * Keyed by a unique identifier (e.g. agentId + serverSlug).
 */
async function ensureMcpSseServer(
  key: string,
  command: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  const existing = managedServers.get(key);
  if (existing) {
    // Check if process is still alive
    try {
      process.kill(existing.process.pid!, 0);
      return existing.url;
    } catch {
      managedServers.delete(key);
    }
  }

  const port = await findFreePort();
  const sseArgs = [...args, "--port", String(port)];
  const mergedEnv = ensurePathInEnv(stripPackageManagerEnv({ ...process.env, ...(env ?? {}) })) as Record<string, string>;

  const child = spawn(command, sseArgs, {
    env: mergedEnv,
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
  });
  child.unref();
  child.stderr?.on("data", () => {}); // drain stderr

  // Poll for the server to start (stdout is suppressed when spawned from Node.js)
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("MCP SSE server startup timeout")), 30000);
    let exited = false;

    child.on("error", (err) => {
      clearTimeout(deadline);
      reject(err);
    });
    child.on("close", (code) => {
      exited = true;
      clearTimeout(deadline);
      reject(new Error(`MCP SSE server exited with code ${code}`));
    });

    const poll = setInterval(() => {
      if (exited) { clearInterval(poll); return; }
      import("node:http").then(({ default: http }) => {
        const req = http.get(`http://localhost:${port}/sse`, (res) => {
          res.destroy();
          clearInterval(poll);
          clearTimeout(deadline);
          resolve();
        });
        req.on("error", () => {});
        req.setTimeout(1000, () => req.destroy());
      });
    }, 500);
  });

  const url = `http://localhost:${port}/sse`;
  managedServers.set(key, { process: child, port, url });
  console.log("[mcp] Started SSE server for %s on port %d", key, port);
  return url;
}

export function mcpServerService(db: Db) {
  return {
    create: async (companyId: string, data: CreateMcpServer, createdByUserId?: string | null) => {
      return db
        .insert(mcpServers)
        .values({ ...data, companyId, createdByUserId: createdByUserId ?? null })
        .returning()
        .then((rows) => rows[0]);
    },

    list: async (companyId: string) => {
      return db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.companyId, companyId))
        .orderBy(mcpServers.name);
    },

    get: async (id: string) => {
      return db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, id))
        .then((rows) => rows[0] ?? null);
    },

    update: async (id: string, data: UpdateMcpServer) => {
      return db
        .update(mcpServers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mcpServers.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    remove: async (id: string) => {
      return db
        .delete(mcpServers)
        .where(eq(mcpServers.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    assignToAgent: async (
      agentId: string,
      mcpServerId: string,
      companyId: string,
      config?: Record<string, unknown> | null,
    ) => {
      return db
        .insert(agentMcpServers)
        .values({ agentId, mcpServerId, companyId, config: config ?? null })
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    removeFromAgent: async (agentId: string, mcpServerId: string) => {
      return db
        .delete(agentMcpServers)
        .where(
          and(
            eq(agentMcpServers.agentId, agentId),
            eq(agentMcpServers.mcpServerId, mcpServerId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    listForAgent: async (agentId: string) => {
      const rows = await db
        .select({
          agentId: agentMcpServers.agentId,
          mcpServerId: agentMcpServers.mcpServerId,
          companyId: agentMcpServers.companyId,
          config: agentMcpServers.config,
          createdAt: agentMcpServers.createdAt,
          mcpServer: mcpServers,
        })
        .from(agentMcpServers)
        .innerJoin(mcpServers, eq(agentMcpServers.mcpServerId, mcpServers.id))
        .where(eq(agentMcpServers.agentId, agentId));

      return rows.map((r) => ({
        agentId: r.agentId,
        mcpServerId: r.mcpServerId,
        companyId: r.companyId,
        config: r.config,
        createdAt: r.createdAt,
        mcpServer: r.mcpServer,
      }));
    },

    buildMcpConfig: async (agentId: string) => {
      const assignments = await db
        .select({
          config: agentMcpServers.config,
          server: mcpServers,
        })
        .from(agentMcpServers)
        .innerJoin(mcpServers, eq(agentMcpServers.mcpServerId, mcpServers.id))
        .where(
          and(
            eq(agentMcpServers.agentId, agentId),
            eq(mcpServers.status, "active"),
          ),
        );

      if (assignments.length === 0) return null;

      const mcpConfig: Record<string, Record<string, unknown>> = {};
      for (const { server, config: overrides } of assignments) {
        const entry: Record<string, unknown> = {};

        if (server.transport === "stdio" || server.transport === "managed-sse") {
          // stdio/managed-sse: start as SSE servers and connect via HTTP.
          // stdio MCP servers fail when Claude CLI is spawned from Node.js (known bug).
          const args = [...(server.args ?? [])];

          // For browser profile servers, inject per-agent profile directory
          if (server.config && (server.config as Record<string, unknown>).browserProfile) {
            const profileDir = path.join(BROWSER_PROFILES_BASE, agentId);
            await fs.mkdir(profileDir, { recursive: true });
            args.push("--user-data-dir", profileDir);
          }

          const sseKey = `${agentId}:${server.slug}`;
          try {
            const sseUrl = await ensureMcpSseServer(
              sseKey,
              server.command!,
              args,
              server.env as Record<string, string> | undefined,
            );
            entry.type = "sse";
            entry.url = sseUrl;
          } catch (err) {
            console.warn("[mcp] Failed to start SSE server for %s: %s", sseKey, err instanceof Error ? err.message : err);
            // Fall back to stdio config (may still fail from Node.js but worth trying)
            entry.type = "stdio";
            entry.command = server.command;
            if (args.length > 0) entry.args = args;
          }
        } else {
          entry.type = server.transport;
          entry.url = server.url;
          if (server.headers && Object.keys(server.headers).length > 0) {
            entry.headers = server.headers;
          }
        }

        if (server.env && Object.keys(server.env).length > 0) {
          entry.env = server.env;
        }

        // Apply per-agent overrides
        if (overrides && typeof overrides === "object") {
          Object.assign(entry, overrides);
        }

        mcpConfig[server.slug] = entry;
      }

      return { mcpServers: mcpConfig };
    },

    ensureBuiltinServers: async (companyId: string) => {
      const builtins = [
        {
          slug: "playwright-browser",
          name: "Playwright Browser",
          description:
            "Browser automation via Playwright MCP. Each agent gets an isolated browser profile with persistent sessions.",
          transport: "managed-sse" as const,
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--headless"],
          config: { browserProfile: true },
        },
        {
          slug: "playwright-browser-cdp",
          name: "Playwright Browser (Real Chrome)",
          description:
            "Connects to your real running Chrome browser via CDP — uses existing login sessions, cookies, and extensions. Ideal for social media and sites with bot detection. Requires Chrome launched with --remote-debugging-port=9222.",
          transport: "managed-sse" as const,
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--cdp-endpoint", "http://localhost:9222"],
        },
        {
          slug: "playwriter-browser",
          name: "Playwriter Browser",
          description:
            "Browser automation via Playwriter Chrome extension relay. Connects to your real Chrome browser — uses existing login sessions, cookies, and extensions. Requires Playwriter Chrome extension installed and activated on target tabs.",
          transport: "sse" as const,
          url: "http://localhost:19988/sse",
        },
      ];

      let firstCreated: typeof mcpServers.$inferSelect | null = null;

      for (const builtin of builtins) {
        const existing = await db
          .select()
          .from(mcpServers)
          .where(
            and(
              eq(mcpServers.companyId, companyId),
              eq(mcpServers.slug, builtin.slug),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          firstCreated ??= existing;
          continue;
        }

        const { slug, name, description, transport, ...rest } = builtin;
        const created = await db
          .insert(mcpServers)
          .values({
            companyId,
            slug,
            name,
            description,
            transport,
            command: "command" in rest ? rest.command : undefined,
            args: "args" in rest ? rest.args : undefined,
            url: "url" in rest ? rest.url : undefined,
            config: "config" in rest ? rest.config : undefined,
            builtin: true,
            status: "active",
          })
          .returning()
          .then((rows) => rows[0]);

        firstCreated ??= created;
      }

      return firstCreated;
    },

    countByAgent: async (companyId: string) => {
      const rows = await db
        .select({
          agentId: agentMcpServers.agentId,
        })
        .from(agentMcpServers)
        .where(eq(agentMcpServers.companyId, companyId));

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.agentId] = (counts[row.agentId] || 0) + 1;
      }
      return counts;
    },

    countByServer: async (companyId: string) => {
      const rows = await db
        .select({
          mcpServerId: agentMcpServers.mcpServerId,
        })
        .from(agentMcpServers)
        .where(eq(agentMcpServers.companyId, companyId));

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.mcpServerId] = (counts[row.mcpServerId] || 0) + 1;
      }
      return counts;
    },
  };
}
