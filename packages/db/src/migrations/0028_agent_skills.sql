CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "skill_slug" text NOT NULL,
  "skill_name" text NOT NULL,
  "skill_description" text,
  "skill_category" text,
  "source_url" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_agent_slug_unique" ON "agent_skills" ("agent_id", "skill_slug");
CREATE INDEX IF NOT EXISTS "agent_skills_agent_idx" ON "agent_skills" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_skills_company_idx" ON "agent_skills" ("company_id");
