import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    skillSlug: text("skill_slug").notNull(),
    skillName: text("skill_name").notNull(),
    skillDescription: text("skill_description"),
    skillCategory: text("skill_category"),
    sourceUrl: text("source_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentSkillUnique: uniqueIndex("agent_skills_agent_slug_unique").on(table.agentId, table.skillSlug),
    agentIdx: index("agent_skills_agent_idx").on(table.agentId),
    companyIdx: index("agent_skills_company_idx").on(table.companyId),
  }),
);
