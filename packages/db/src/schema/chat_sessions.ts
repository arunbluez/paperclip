import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    source: text("source").notNull().default("web"),
    telegramChatId: text("telegram_chat_id"),
    title: text("title"),
    status: text("status").notNull().default("active"),
    claudeSessionId: text("claude_session_id"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStatusIdx: index("chat_sessions_company_agent_status_idx").on(
      table.companyId,
      table.agentId,
      table.status,
    ),
    agentTelegramUnique: uniqueIndex("chat_sessions_agent_telegram_unique")
      .on(table.agentId, table.telegramChatId)
      .where(sql`telegram_chat_id IS NOT NULL`),
  }),
);
