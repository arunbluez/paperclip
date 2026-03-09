import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentSkills, customSkills } from "@paperclipai/db";
import type { AssignSkill } from "@paperclipai/shared";
import { SKILL_CATALOG } from "@paperclipai/shared";

export function skillService(db: Db) {
  return {
    assignToAgent: async (agentId: string, companyId: string, data: AssignSkill) => {
      return db
        .insert(agentSkills)
        .values({
          agentId,
          companyId,
          skillSlug: data.skillSlug,
          skillName: data.skillName,
          skillDescription: data.skillDescription ?? null,
          skillCategory: data.skillCategory ?? null,
          sourceUrl: data.sourceUrl,
        })
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    removeFromAgent: async (agentId: string, skillSlug: string) => {
      return db
        .delete(agentSkills)
        .where(
          and(
            eq(agentSkills.agentId, agentId),
            eq(agentSkills.skillSlug, skillSlug),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    listForAgent: async (agentId: string) => {
      return db
        .select()
        .from(agentSkills)
        .where(eq(agentSkills.agentId, agentId))
        .orderBy(agentSkills.skillName);
    },

    listForCompany: async (companyId: string) => {
      return db
        .select()
        .from(agentSkills)
        .where(eq(agentSkills.companyId, companyId))
        .orderBy(agentSkills.skillName);
    },

    buildSkillUrlsForAgent: async (agentId: string) => {
      const rows = await db
        .select({
          skillSlug: agentSkills.skillSlug,
          sourceUrl: agentSkills.sourceUrl,
          companyId: agentSkills.companyId,
        })
        .from(agentSkills)
        .where(eq(agentSkills.agentId, agentId));

      if (rows.length === 0) return [];

      // Fetch custom skills for this company to resolve inline content
      const companyId = rows[0]!.companyId;
      const companyCustomSkills = await db
        .select()
        .from(customSkills)
        .where(eq(customSkills.companyId, companyId));

      const customMap = new Map(companyCustomSkills.map((cs) => [cs.slug, cs]));

      return rows.map((r) => {
        // Check if it's a custom skill with inline content
        const custom = customMap.get(r.skillSlug);
        if (custom?.skillMdContent) {
          return { slug: r.skillSlug, skillMdUrl: null, skillMdContent: custom.skillMdContent };
        }
        if (custom?.skillMdUrl) {
          return { slug: r.skillSlug, skillMdUrl: custom.skillMdUrl, skillMdContent: null };
        }

        // Fall back to catalog
        const catalogEntry = SKILL_CATALOG.find((e) => e.slug === r.skillSlug);
        const skillMdUrl = catalogEntry?.skillMdUrl ?? deriveSkillMdUrl(r.sourceUrl);
        return { slug: r.skillSlug, skillMdUrl, skillMdContent: null };
      });
    },
  };
}

function deriveSkillMdUrl(sourceUrl: string): string {
  return sourceUrl
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/tree/", "/")
    .replace("/blob/", "/")
    .replace(/\/$/, "") + "/SKILL.md";
}
