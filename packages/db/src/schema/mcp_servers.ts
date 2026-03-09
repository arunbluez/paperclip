import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    transport: text("transport").notNull(),
    command: text("command"),
    args: jsonb("args").$type<string[]>(),
    url: text("url"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    env: jsonb("env").$type<Record<string, string>>(),
    config: jsonb("config").$type<Record<string, unknown>>(),
    builtin: boolean("builtin").notNull().default(false),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("mcp_servers_company_slug_idx").on(table.companyId, table.slug),
    companyStatusIdx: index("mcp_servers_company_status_idx").on(table.companyId, table.status),
  }),
);
