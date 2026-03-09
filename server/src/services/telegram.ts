import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { chatService } from "./chat.js";

const TELEGRAM_API = "https://api.telegram.org";

/** Active bot instances keyed by agentId */
const activeBots = new Map<string, Bot>();

/** Download a Telegram file to a local temp path */
async function downloadTelegramFile(botToken: string, fileId: string): Promise<string> {
  const fileRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getFile?file_id=${fileId}`);
  const fileBody = (await fileRes.json()) as { ok: boolean; result?: { file_path?: string } };
  if (!fileBody.ok || !fileBody.result?.file_path) throw new Error("Failed to get file from Telegram");

  const downloadUrl = `${TELEGRAM_API}/file/bot${botToken}/${fileBody.result.file_path}`;
  const resp = await fetch(downloadUrl);
  if (!resp.ok) throw new Error("Failed to download file from Telegram");

  const ext = path.extname(fileBody.result.file_path) || ".jpg";
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-img-"));
  const tmpPath = path.join(tmpDir, `photo${ext}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}

export function telegramService(db: Db) {
  const chatSvc = chatService(db);

  async function getAgent(agentId: string) {
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
    if (!agent) throw notFound("Agent not found");
    return agent;
  }

  async function startBot(agentId: string, botToken: string) {
    // Stop existing bot if any — must await to fully release the polling connection
    await stopBot(agentId);

    const bot = new Bot(botToken);

    // Handle text messages and photos (with optional captions)
    bot.on(["message:text", "message:photo"], async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.message.text ?? ctx.message.caption ?? "";
      const photos = ctx.message.photo;

      // Handle /reset command — archive session and start fresh
      if (text.trim() === "/reset") {
        try {
          const session = await chatSvc.findOrCreateTelegramSession(agentId, chatId);
          await chatSvc.archiveSession(session.id);
          await ctx.reply("Session reset. Send a message to start a new conversation.");
        } catch (err) {
          console.error("[telegram] Error resetting session for agent %s:", agentId, err);
          await ctx.reply("Failed to reset session.").catch(() => {});
        }
        return;
      }

      const imagePaths: string[] = [];

      try {
        // Show typing indicator immediately
        await ctx.replyWithChatAction("typing");

        // Download photo if present (use the largest resolution — last in the array)
        if (photos && photos.length > 0) {
          const largest = photos[photos.length - 1];
          try {
            const imgPath = await downloadTelegramFile(botToken, largest.file_id);
            imagePaths.push(imgPath);
          } catch (err) {
            console.warn("[telegram] Failed to download photo for agent %s:", agentId, err);
          }
        }

        const messageText = text || (imagePaths.length > 0 ? "The user sent an image. Please analyze it." : "");
        if (!messageText && imagePaths.length === 0) return;

        const session = await chatSvc.findOrCreateTelegramSession(agentId, chatId);
        let responseText = "";

        // Keep typing indicator alive (Telegram clears it after ~5s)
        const typingInterval = setInterval(() => {
          ctx.replyWithChatAction("typing").catch(() => {});
        }, 4000);

        try {
          await chatSvc.sendMessage(session.id, messageText, (event) => {
            if (event.type === "content_delta" && event.content) {
              responseText += event.content;
            }
          }, imagePaths.length > 0 ? imagePaths : undefined);
        } finally {
          clearInterval(typingInterval);
        }

        if (responseText) {
          // Telegram has a 4096 char limit per message
          const chunks = splitMessage(responseText, 4096);
          for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(async () => {
              // Markdown parse failed — retry as plain text
              await ctx.reply(chunk);
            });
          }
        }
      } catch (err) {
        console.error("[telegram] Error processing message for agent %s:", agentId, err);
        await ctx.reply("Sorry, I encountered an error processing your message.").catch(() => {});
      } finally {
        // Clean up temp image files
        for (const p of imagePaths) {
          fs.rm(path.dirname(p), { recursive: true, force: true }).catch(() => {});
        }
      }
    });

    bot.catch((err) => {
      console.error("[telegram] Bot error for agent %s:", agentId, err);
    });

    // Start long polling (non-blocking).
    // Capture the promise to detect polling crashes and auto-restart.
    const pollingPromise = bot.start({
      onStart: (info) => {
        console.log("[telegram] Bot @%s started for agent %s (long polling)", info.username, agentId);
      },
    });

    activeBots.set(agentId, bot);

    // If polling exits unexpectedly (crash/network error), auto-restart after a delay
    pollingPromise
      .then(() => {
        // Polling stopped normally (via bot.stop()) — nothing to do
      })
      .catch(async (err) => {
        console.error("[telegram] Polling crashed for agent %s, will retry in 5s:", agentId, err);
        activeBots.delete(agentId);
        await new Promise((r) => setTimeout(r, 5000));
        // Only restart if still configured
        try {
          const agent = await getAgent(agentId);
          const meta = (agent.metadata ?? {}) as Record<string, unknown>;
          if (meta.telegramConnected === true && typeof meta.telegramBotToken === "string") {
            console.log("[telegram] Auto-restarting bot for agent %s", agentId);
            startBot(agentId, meta.telegramBotToken);
          }
        } catch {
          console.error("[telegram] Failed to auto-restart bot for agent %s", agentId);
        }
      });
  }

  async function stopBot(agentId: string) {
    const existing = activeBots.get(agentId);
    if (existing) {
      activeBots.delete(agentId);
      try {
        await existing.stop();
      } catch (err) {
        console.warn("[telegram] Error stopping bot for agent %s:", agentId, err);
      }
      console.log("[telegram] Bot stopped for agent %s", agentId);
    }
  }

  return {
    connect: async (agentId: string, botToken: string) => {
      const agent = await getAgent(agentId);
      if (agent.reportsTo !== null) throw unprocessable("Telegram is only available for top-level agents");

      // Validate token by calling getMe
      const meRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
      const meBody = (await meRes.json()) as { ok: boolean; result?: { username?: string } };
      if (!meBody.ok) throw unprocessable("Invalid Telegram bot token");
      const botUsername = meBody.result?.username ?? null;

      // Flush any pending updates so polling starts clean (avoids 409 conflict)
      await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook?drop_pending_updates=true`).catch(() => {});

      // Store token and config in agent metadata
      const metadata = {
        ...(agent.metadata ?? {}),
        telegramBotToken: botToken,
        telegramBotUsername: botUsername,
        telegramConnected: true,
      };
      await db
        .update(agents)
        .set({ metadata, updatedAt: new Date() })
        .where(eq(agents.id, agentId));

      // Start the bot with long polling
      await startBot(agentId, botToken);

      return { botUsername };
    },

    disconnect: async (agentId: string) => {
      // Stop the bot — must await to fully release the polling connection
      await stopBot(agentId);

      const agent = await getAgent(agentId);

      // Clear telegram fields from metadata
      const metadata = { ...(agent.metadata ?? {}) } as Record<string, unknown>;
      delete metadata.telegramBotToken;
      delete metadata.telegramBotUsername;
      delete metadata.telegramConnected;
      await db
        .update(agents)
        .set({ metadata, updatedAt: new Date() })
        .where(eq(agents.id, agentId));
    },

    getStatus: async (agentId: string) => {
      const agent = await getAgent(agentId);
      const meta = (agent.metadata ?? {}) as Record<string, unknown>;
      const isRunning = activeBots.has(agentId);
      return {
        connected: meta.telegramConnected === true,
        botUsername: (meta.telegramBotUsername as string) ?? null,
        polling: isRunning,
      };
    },

    /** Resume bots for all agents that have telegram configured. Call on server start. */
    resumeAll: async () => {
      const rows = await db.select().from(agents);
      let count = 0;
      for (const agent of rows) {
        const meta = (agent.metadata ?? {}) as Record<string, unknown>;
        if (meta.telegramConnected === true && typeof meta.telegramBotToken === "string") {
          startBot(agent.id, meta.telegramBotToken);
          count++;
        }
      }
      if (count > 0) {
        console.log("[telegram] Resumed %d bot(s)", count);
      }
    },

    /** Stop all active bots. Call on server shutdown. */
    stopAll: async () => {
      await Promise.all(
        [...activeBots.keys()].map((agentId) => stopBot(agentId)),
      );
    },
  };
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen / 2) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n/, "");
  }
  return chunks;
}
