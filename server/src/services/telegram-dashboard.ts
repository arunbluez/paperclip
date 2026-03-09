import { Bot, InlineKeyboard, InputFile } from "grammy";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { companyService } from "./companies.js";
import { agentService } from "./agents.js";
import { issueService } from "./issues.js";
import { approvalService } from "./approvals.js";
import { dashboardService } from "./dashboard.js";

const TAG = "[telegram-dashboard]";
const TELEGRAM_API = "https://api.telegram.org";

function splitMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen / 2) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n/, "");
  }
  return chunks;
}

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function cents(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}

function id8(id: string): string {
  return id.slice(0, 8);
}

const STATUS_EMOJI: Record<string, string> = {
  active: "\uD83D\uDFE2", idle: "\uD83D\uDFE2", running: "\uD83D\uDD35",
  paused: "\u23F8\uFE0F", error: "\uD83D\uDD34", terminated: "\u26AB",
};

const TASK_STATUS_EMOJI: Record<string, string> = {
  backlog: "\uD83D\uDCCB", todo: "\uD83D\uDCDD", in_progress: "\uD83D\uDD04",
  in_review: "\uD83D\uDC40", blocked: "\uD83D\uDEAB", done: "\u2705", cancelled: "\u274C",
};

/** Active bot instances keyed by companyId */
const activeBots = new Map<string, Bot>();

export function telegramDashboardService(db: Db, storageService: StorageService) {
  const companySvc = companyService(db);
  const agentsSvc = agentService(db);
  const issueSvc = issueService(db);
  const approvalSvc = approvalService(db);
  const dashSvc = dashboardService(db);

  // In-memory state per chat
  const chatCompanyMap = new Map<string, string>();
  const awaitingRevisionComment = new Map<string, string>();

  async function getCompanyConfig(companyId: string) {
    const row = await db.select().from(companies).where(eq(companies.id, companyId)).then((r) => r[0] ?? null);
    return row;
  }

  function findByPrefix<T extends { id: string }>(items: T[], prefix: string): T | undefined {
    return items.find((item) => item.id.startsWith(prefix));
  }

  async function sendReply(ctx: any, text: string, extra?: Record<string, unknown>) {
    const chunks = splitMessage(text);
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await ctx.reply(chunks[i], {
        parse_mode: "Markdown",
        ...(isLast ? extra : {}),
      }).catch(async () => {
        await ctx.reply(chunks[i], isLast ? extra : undefined);
      });
    }
  }

  async function resolveCompany(chatId: string): Promise<string | null> {
    const cached = chatCompanyMap.get(chatId);
    if (cached) return cached;
    const allCompanies = await companySvc.list();
    if (allCompanies.length === 1) {
      chatCompanyMap.set(chatId, allCompanies[0].id);
      return allCompanies[0].id;
    }
    return null;
  }

  async function startBot(companyId: string, botToken: string, authorizedChatId: string | null) {
    await stopBot(companyId);

    const bot = new Bot(botToken);

    function isAuthorized(chatId: number | string): boolean {
      const id = String(chatId);
      if (!authorizedChatId) {
        console.log(TAG, `[${companyId}] Message from chat ID: ${id} \u2014 set chat ID in settings to authorize`);
        return false;
      }
      return id === authorizedChatId;
    }

    // ---------- COMMANDS ----------

    bot.command("start", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await sendReply(ctx, [
        "\uD83D\uDCCB *Paperclip Dashboard Bot*",
        "",
        "Commands:",
        "/status  \u2014 Dashboard overview",
        "/agents  \u2014 Agent list & details",
        "/tasks   \u2014 Task list by status",
        "/approvals \u2014 Pending approvals",
        "/help    \u2014 Show this menu",
      ].join("\n"));
    });

    bot.command("help", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await sendReply(ctx, [
        "\uD83D\uDCCB *Paperclip Dashboard Bot*",
        "",
        "/status  \u2014 Dashboard overview",
        "/agents  \u2014 Agent list & details",
        "/tasks   \u2014 Task list by status",
        "/approvals \u2014 Pending approvals",
        "/help    \u2014 Show this menu",
      ].join("\n"));
    });

    bot.command("status", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await handleStatus(ctx);
    });

    bot.command("agents", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await handleAgentList(ctx);
    });

    bot.command("tasks", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await handleTaskFilters(ctx);
    });

    bot.command("approvals", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      await handleApprovalList(ctx);
    });

    // ---------- TEXT MESSAGES (revision comment capture) ----------

    bot.on("message:text", async (ctx) => {
      if (!isAuthorized(ctx.chat.id)) return;
      const chatId = String(ctx.chat.id);
      const approvalId = awaitingRevisionComment.get(chatId);
      if (approvalId) {
        awaitingRevisionComment.delete(chatId);
        try {
          await approvalSvc.requestRevision(approvalId, "telegram-dashboard", ctx.message.text);
          await sendReply(ctx, `\u2705 Revision requested with comment: "${truncate(ctx.message.text, 100)}"`);
        } catch (err: any) {
          await sendReply(ctx, `\u274C Failed to request revision: ${err.message ?? err}`);
        }
      }
    });

    // ---------- CALLBACK QUERIES ----------

    bot.on("callback_query:data", async (ctx) => {
      if (!ctx.chat || !isAuthorized(ctx.chat.id)) return;
      const data = ctx.callbackQuery.data;
      const parts = data.split(":");

      try {
        switch (parts[0]) {
          case "s": await handleStatus(ctx); break;
          case "co": await handleCompanySelect(ctx, parts[1]); break;
          case "ag":
            if (parts.length > 1) await handleAgentDetail(ctx, parts[1]);
            else await handleAgentList(ctx);
            break;
          case "agt": await handleAgentTasks(ctx, parts[1]); break;
          case "t": await handleTaskList(ctx, parts[1] || "open", Number(parts[2]) || 0); break;
          case "tf": await handleTaskFilters(ctx); break;
          case "td": await handleTaskDetail(ctx, parts[1]); break;
          case "ta": await handleTaskAssets(ctx, parts[1]); break;
          case "ap": await handleApprovalList(ctx); break;
          case "apd": await handleApprovalDetail(ctx, parts[1]); break;
          case "apr": await handleApproveConfirm(ctx, parts[1]); break;
          case "arj": await handleRejectConfirm(ctx, parts[1]); break;
          case "arv": await handleRevisionStart(ctx, parts[1]); break;
          case "apc": await handleApproveExecute(ctx, parts[1]); break;
          case "arc": await handleRejectExecute(ctx, parts[1]); break;
        }
      } catch (err: any) {
        console.error(TAG, "Callback error:", err);
        await ctx.answerCallbackQuery({ text: "Error: " + truncate(err.message, 100) });
        return;
      }
      await ctx.answerCallbackQuery().catch(() => {});
    });

    // ---------- HANDLERS ----------

    async function handleCompanySelect(ctx: any, prefix: string) {
      const all = await companySvc.list();
      const company = findByPrefix(all, prefix);
      if (!company) { await sendReply(ctx, "Company not found."); return; }
      chatCompanyMap.set(String(ctx.chat.id), company.id);
      await sendReply(ctx, `Selected *${company.name}*. Use /status to view the dashboard.`);
    }

    async function handleStatus(ctx: any) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }

      const summary = await dashSvc.summary(cid);
      const all = await companySvc.list();
      const company = all.find((c) => c.id === cid);

      const text = [
        `\uD83D\uDCCA *Dashboard \u2014 ${company?.name ?? "Unknown"}*`,
        "",
        `Agents: ${summary.agents.running} running \u00B7 ${summary.agents.active} active \u00B7 ${summary.agents.paused} paused`,
        `Tasks: ${summary.tasks.open} open \u00B7 ${summary.tasks.inProgress} in progress \u00B7 ${summary.tasks.blocked} blocked \u00B7 ${summary.tasks.done} done`,
        `Budget: ${cents(summary.costs.monthSpendCents)} / ${cents(summary.costs.monthBudgetCents)} (${summary.costs.monthUtilizationPercent}%)`,
        `Pending Approvals: ${summary.pendingApprovals}`,
        `Stale Tasks: ${summary.staleTasks}`,
      ].join("\n");

      const kb = new InlineKeyboard()
        .text("View Agents", "ag").text("View Tasks", "tf").text("View Approvals", "ap");
      await sendReply(ctx, text, { reply_markup: kb });
    }

    async function handleAgentList(ctx: any) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const list = await agentsSvc.list(cid);
      if (list.length === 0) {
        await sendReply(ctx, "No agents found.", { reply_markup: new InlineKeyboard().text("\u2190 Dashboard", "s") });
        return;
      }
      const kb = new InlineKeyboard();
      for (const a of list) {
        const e = STATUS_EMOJI[a.status] ?? "\u26AA";
        kb.text(`${e} ${truncate(a.name, 25)} (${a.status})`, `ag:${id8(a.id)}`).row();
      }
      kb.text("\u2190 Dashboard", "s");
      await sendReply(ctx, "\uD83E\uDD16 *Agents*", { reply_markup: kb });
    }

    async function handleAgentDetail(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const list = await agentsSvc.list(cid);
      const agent = findByPrefix(list, prefix);
      if (!agent) { await sendReply(ctx, "Agent not found."); return; }

      const e = STATUS_EMOJI[agent.status] ?? "\u26AA";
      const lines = [
        `${e} *${agent.name}*`, "",
        `Role: ${agent.role}`,
        agent.title ? `Title: ${agent.title}` : null,
        `Status: ${agent.status}`,
        `Budget: ${cents(agent.budgetMonthlyCents)}/mo`,
        agent.lastHeartbeatAt ? `Last heartbeat: ${new Date(agent.lastHeartbeatAt).toLocaleString()}` : null,
      ].filter(Boolean).join("\n");

      const kb = new InlineKeyboard()
        .text(`Tasks for ${truncate(agent.name, 20)}`, `agt:${id8(agent.id)}`).row()
        .text("\u2190 Back to Agents", "ag");
      await sendReply(ctx, lines, { reply_markup: kb });
    }

    async function handleAgentTasks(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const list = await agentsSvc.list(cid);
      const agent = findByPrefix(list, prefix);
      if (!agent) { await sendReply(ctx, "Agent not found."); return; }

      const tasks = await issueSvc.list(cid, { assigneeAgentId: agent.id });
      if (tasks.length === 0) {
        await sendReply(ctx, `No tasks assigned to ${agent.name}.`, {
          reply_markup: new InlineKeyboard().text("\u2190 Back to Agent", `ag:${id8(agent.id)}`),
        });
        return;
      }
      const kb = new InlineKeyboard();
      for (const t of tasks.slice(0, 10)) {
        const e = TASK_STATUS_EMOJI[t.status] ?? "\uD83D\uDCC4";
        kb.text(truncate(`${e} ${t.identifier ?? ""} ${t.title}`, 45), `td:${id8(t.id)}`).row();
      }
      if (tasks.length > 10) kb.text(`... and ${tasks.length - 10} more`, `ag:${id8(agent.id)}`).row();
      kb.text("\u2190 Back to Agent", `ag:${id8(agent.id)}`);
      await sendReply(ctx, `\uD83D\uDCCB *Tasks for ${agent.name}* (${tasks.length})`, { reply_markup: kb });
    }

    async function handleTaskFilters(ctx: any) {
      const kb = new InlineKeyboard()
        .text("All Open", "t:open:0").text("In Progress", "t:ip:0").text("Blocked", "t:blocked:0").row()
        .text("Todo", "t:todo:0").text("Done", "t:done:0").text("Backlog", "t:backlog:0").row()
        .text("\u2190 Dashboard", "s");
      await sendReply(ctx, "\uD83D\uDCCB *Tasks \u2014 Select filter*", { reply_markup: kb });
    }

    async function handleTaskList(ctx: any, filter: string, page: number) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const PAGE_SIZE = 10;
      const filterMap: Record<string, string | undefined> = {
        open: undefined, ip: "in_progress", blocked: "blocked", todo: "todo", done: "done", backlog: "backlog",
      };
      const statusFilter = filterMap[filter];
      let tasks = await issueSvc.list(cid, statusFilter ? { status: statusFilter } : {});
      if (filter === "open") tasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled");

      const total = tasks.length;
      const page_items = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (page_items.length === 0) {
        await sendReply(ctx, "No tasks found.", { reply_markup: new InlineKeyboard().text("\u2190 Filters", "tf") });
        return;
      }
      const kb = new InlineKeyboard();
      for (const t of page_items) {
        const e = TASK_STATUS_EMOJI[t.status] ?? "\uD83D\uDCC4";
        kb.text(truncate(`${e} ${t.identifier ?? ""} ${t.title}`, 45), `td:${id8(t.id)}`).row();
      }
      const hasNext = (page + 1) * PAGE_SIZE < total;
      const hasPrev = page > 0;
      if (hasPrev) kb.text("\u2190 Prev", `t:${filter}:${page - 1}`);
      if (hasNext) kb.text("Next \u2192", `t:${filter}:${page + 1}`);
      if (hasPrev || hasNext) kb.row();
      kb.text("\u2190 Filters", "tf");

      const label = filter === "ip" ? "In Progress" : filter.charAt(0).toUpperCase() + filter.slice(1);
      await sendReply(ctx, `\uD83D\uDCCB *Tasks \u2014 ${label}* (${total}, page ${page + 1})`, { reply_markup: kb });
    }

    async function handleTaskDetail(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const tasks = await issueSvc.list(cid);
      const task = findByPrefix(tasks, prefix);
      if (!task) { await sendReply(ctx, "Task not found."); return; }

      const e = TASK_STATUS_EMOJI[task.status] ?? "\uD83D\uDCC4";
      const lines = [
        `${e} *${task.identifier ?? ""} ${task.title}*`, "",
        `Status: ${task.status}`,
        `Priority: ${task.priority ?? "none"}`,
        task.assigneeAgentId ? `Assignee: agent ${id8(task.assigneeAgentId)}` : "Assignee: unassigned",
        task.description ? `\n${truncate(task.description, 500)}` : null,
      ].filter(Boolean).join("\n");

      const kb = new InlineKeyboard().text("View Assets", `ta:${id8(task.id)}`).row().text("\u2190 Back to Tasks", "tf");
      await sendReply(ctx, lines, { reply_markup: kb });
    }

    async function handleTaskAssets(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const tasks = await issueSvc.list(cid);
      const task = findByPrefix(tasks, prefix);
      if (!task) { await sendReply(ctx, "Task not found."); return; }

      const attachments = await issueSvc.listAttachments(task.id);
      if (attachments.length === 0) {
        await sendReply(ctx, "No assets attached to this task.", {
          reply_markup: new InlineKeyboard().text("\u2190 Back to Task", `td:${id8(task.id)}`),
        });
        return;
      }

      const images = attachments.filter((a: any) => a.contentType?.startsWith("image/"));
      const others = attachments.filter((a: any) => !a.contentType?.startsWith("image/"));

      for (const att of images.slice(0, 10)) {
        try {
          const result = await storageService.getObject(cid, att.objectKey);
          const bufs: Buffer[] = [];
          for await (const chunk of result.stream) {
            bufs.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          await ctx.replyWithPhoto(new InputFile(Buffer.concat(bufs), att.originalFilename ?? "image.jpg"));
        } catch (err) {
          console.error(TAG, "Failed to send image:", err);
        }
      }
      if (others.length > 0) {
        await sendReply(ctx, others.map((a: any) => `\uD83D\uDCCE ${a.originalFilename ?? a.objectKey} (${a.contentType})`).join("\n"));
      }
      await sendReply(ctx, `\uD83D\uDCCE ${attachments.length} attachment(s)`, {
        reply_markup: new InlineKeyboard().text("\u2190 Back to Task", `td:${id8(task.id)}`),
      });
    }

    async function handleApprovalList(ctx: any) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const pending = await approvalSvc.list(cid, "pending");
      if (pending.length === 0) {
        await sendReply(ctx, "No pending approvals.", { reply_markup: new InlineKeyboard().text("\u2190 Dashboard", "s") });
        return;
      }
      const kb = new InlineKeyboard();
      for (const a of pending.slice(0, 10)) {
        const who = a.requestedByAgentId ? "agent " + id8(a.requestedByAgentId) : "system";
        kb.text(truncate(`\u23F3 ${a.type} \u2014 ${who}`, 45), `apd:${id8(a.id)}`).row();
      }
      if (pending.length > 10) kb.text(`... and ${pending.length - 10} more`, "ap").row();
      kb.text("\u2190 Dashboard", "s");
      await sendReply(ctx, `\u23F3 *Pending Approvals* (${pending.length})`, { reply_markup: kb });
    }

    async function handleApprovalDetail(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const all = await approvalSvc.list(cid);
      const approval = findByPrefix(all, prefix);
      if (!approval) { await sendReply(ctx, "Approval not found."); return; }

      const payload = approval.payload as Record<string, unknown> | null;
      const se =
        approval.status === "pending" ? "\u23F3" :
        approval.status === "approved" ? "\u2705" :
        approval.status === "rejected" ? "\u274C" : "\uD83D\uDD04";

      const lines = [
        `${se} *Approval: ${approval.type}*`, "",
        `Status: ${approval.status}`,
        `Requester: ${approval.requestedByAgentId ? "agent " + id8(approval.requestedByAgentId) : "system"}`,
        approval.decisionNote ? `Decision note: ${truncate(approval.decisionNote, 200)}` : null,
        "", `Payload: ${payload ? truncate(JSON.stringify(payload), 300) : "No payload"}`,
      ].filter(Boolean).join("\n");

      const kb = new InlineKeyboard();
      if (approval.status === "pending" || approval.status === "revision_requested") {
        kb.text("\u2705 Approve", `apr:${id8(approval.id)}`)
          .text("\u274C Reject", `arj:${id8(approval.id)}`).row();
      }
      if (approval.status === "pending") {
        kb.text("\uD83D\uDD04 Request Revision", `arv:${id8(approval.id)}`).row();
      }
      kb.text("\u2190 Back to Approvals", "ap");
      await sendReply(ctx, lines, { reply_markup: kb });
    }

    async function handleApproveConfirm(ctx: any, prefix: string) {
      const kb = new InlineKeyboard()
        .text("Yes, approve", `apc:${prefix.slice(0, 8)}`).text("Cancel", `apd:${prefix.slice(0, 8)}`);
      await sendReply(ctx, "\u26A0\uFE0F *Confirm approval?*", { reply_markup: kb });
    }

    async function handleRejectConfirm(ctx: any, prefix: string) {
      const kb = new InlineKeyboard()
        .text("Yes, reject", `arc:${prefix.slice(0, 8)}`).text("Cancel", `apd:${prefix.slice(0, 8)}`);
      await sendReply(ctx, "\u26A0\uFE0F *Confirm rejection?*", { reply_markup: kb });
    }

    async function handleApproveExecute(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const all = await approvalSvc.list(cid);
      const approval = findByPrefix(all, prefix);
      if (!approval) { await sendReply(ctx, "Approval not found."); return; }
      try {
        await approvalSvc.approve(approval.id, "telegram-dashboard");
        await sendReply(ctx, `\u2705 Approval *${approval.type}* approved.`);
      } catch (err: any) {
        await sendReply(ctx, `\u274C Failed to approve: ${err.message ?? err}`);
      }
    }

    async function handleRejectExecute(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const all = await approvalSvc.list(cid);
      const approval = findByPrefix(all, prefix);
      if (!approval) { await sendReply(ctx, "Approval not found."); return; }
      try {
        await approvalSvc.reject(approval.id, "telegram-dashboard");
        await sendReply(ctx, `\u274C Approval *${approval.type}* rejected.`);
      } catch (err: any) {
        await sendReply(ctx, `\u274C Failed to reject: ${err.message ?? err}`);
      }
    }

    async function handleRevisionStart(ctx: any, prefix: string) {
      const cid = await resolveCompany(String(ctx.chat.id));
      if (!cid) { await sendCompanyPicker(ctx); return; }
      const all = await approvalSvc.list(cid);
      const approval = findByPrefix(all, prefix);
      if (!approval) { await sendReply(ctx, "Approval not found."); return; }
      awaitingRevisionComment.set(String(ctx.chat.id), approval.id);
      await sendReply(ctx, "\uD83D\uDCAC Reply with your revision comment:");
    }

    async function sendCompanyPicker(ctx: any) {
      const all = await companySvc.list();
      if (all.length === 0) { await sendReply(ctx, "No companies found."); return; }
      const kb = new InlineKeyboard();
      for (const c of all) kb.text(c.name, `co:${id8(c.id)}`).row();
      await sendReply(ctx, "\uD83C\uDFE2 *Select a company:*", { reply_markup: kb });
    }

    bot.catch((err) => {
      console.error(TAG, "Bot error:", err);
    });

    const pollingPromise = bot.start({
      onStart: (info) => {
        console.log(TAG, `Bot @${info.username} started for company ${companyId} (long polling)`);
      },
    });

    activeBots.set(companyId, bot);

    pollingPromise.catch(async (err) => {
      console.error(TAG, `Polling crashed for company ${companyId}, will retry in 5s:`, err);
      activeBots.delete(companyId);
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const row = await getCompanyConfig(companyId);
        if (row?.telegramDashboardBotToken) {
          console.log(TAG, `Auto-restarting bot for company ${companyId}`);
          startBot(companyId, row.telegramDashboardBotToken, row.telegramDashboardChatId);
        }
      } catch {
        console.error(TAG, `Failed to auto-restart bot for company ${companyId}`);
      }
    });
  }

  async function stopBot(companyId: string) {
    const existing = activeBots.get(companyId);
    if (existing) {
      activeBots.delete(companyId);
      try { await existing.stop(); } catch {}
      console.log(TAG, `Bot stopped for company ${companyId}`);
    }
  }

  return {
    /** Connect a dashboard bot for a company. Validates token, stores config, starts polling. */
    connect: async (companyId: string, botToken: string, chatId: string | null) => {
      // Validate token
      const meRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
      const meBody = (await meRes.json()) as { ok: boolean; result?: { username?: string } };
      if (!meBody.ok) throw new Error("Invalid Telegram bot token");
      const botUsername = meBody.result?.username ?? null;

      // Flush pending updates
      await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook?drop_pending_updates=true`).catch(() => {});

      // Store in DB
      await db.update(companies).set({
        telegramDashboardBotToken: botToken,
        telegramDashboardChatId: chatId,
        telegramDashboardBotUsername: botUsername,
        updatedAt: new Date(),
      }).where(eq(companies.id, companyId));

      // Start bot
      await startBot(companyId, botToken, chatId);

      return { botUsername, chatId };
    },

    /** Disconnect and remove the dashboard bot config. */
    disconnect: async (companyId: string) => {
      await stopBot(companyId);
      await db.update(companies).set({
        telegramDashboardBotToken: null,
        telegramDashboardChatId: null,
        telegramDashboardBotUsername: null,
        updatedAt: new Date(),
      }).where(eq(companies.id, companyId));
    },

    /** Update the authorized chat ID for an already-connected bot. */
    setChatId: async (companyId: string, chatId: string) => {
      const row = await getCompanyConfig(companyId);
      if (!row?.telegramDashboardBotToken) throw new Error("Dashboard bot not connected");

      await db.update(companies).set({
        telegramDashboardChatId: chatId,
        updatedAt: new Date(),
      }).where(eq(companies.id, companyId));

      // Restart bot with new chat ID
      await startBot(companyId, row.telegramDashboardBotToken, chatId);

      return { chatId };
    },

    /** Get the status of the dashboard bot for a company. */
    getStatus: async (companyId: string) => {
      const row = await getCompanyConfig(companyId);
      return {
        connected: !!row?.telegramDashboardBotToken,
        botUsername: row?.telegramDashboardBotUsername ?? null,
        chatId: row?.telegramDashboardChatId ?? null,
        polling: activeBots.has(companyId),
      };
    },

    /** Resume dashboard bots for all companies that have them configured. Call on server start. */
    resumeAll: async () => {
      const rows = await db.select().from(companies);
      let count = 0;
      for (const row of rows) {
        if (row.telegramDashboardBotToken) {
          startBot(row.id, row.telegramDashboardBotToken, row.telegramDashboardChatId);
          count++;
        }
      }
      if (count > 0) console.log(TAG, `Resumed ${count} bot(s)`);
    },

    /** Expose startBot for internal use (e.g. after connect). */
    start: async () => {
      // Alias for resumeAll — used in app.ts on startup
      const rows = await db.select().from(companies);
      let count = 0;
      for (const row of rows) {
        if (row.telegramDashboardBotToken) {
          startBot(row.id, row.telegramDashboardBotToken, row.telegramDashboardChatId);
          count++;
        }
      }
      if (count > 0) console.log(TAG, `Resumed ${count} bot(s)`);
    },
  };
}
