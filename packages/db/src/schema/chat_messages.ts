import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { chatSessions } from "./chat_sessions.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => chatSessions.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionCreatedAtIdx: index("chat_messages_session_created_at_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  }),
);
