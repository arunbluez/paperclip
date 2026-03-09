CREATE TABLE IF NOT EXISTS "custom_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "skill_md_content" text,
  "skill_md_url" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_skills_company_slug_unique" ON "custom_skills" ("company_id", "slug");
CREATE INDEX IF NOT EXISTS "custom_skills_company_idx" ON "custom_skills" ("company_id");
