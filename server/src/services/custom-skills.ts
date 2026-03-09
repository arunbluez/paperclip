import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { customSkills } from "@paperclipai/db";
import type { CreateCustomSkill, UpdateCustomSkill } from "@paperclipai/shared";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function customSkillService(db: Db) {
  return {
    list: async (companyId: string) => {
      return db
        .select()
        .from(customSkills)
        .where(eq(customSkills.companyId, companyId))
        .orderBy(customSkills.name);
    },

    getById: async (id: string) => {
      const rows = await db
        .select()
        .from(customSkills)
        .where(eq(customSkills.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    create: async (companyId: string, data: CreateCustomSkill, userId?: string) => {
      const slug = `custom-${slugify(data.name)}-${Date.now().toString(36)}`;
      const rows = await db
        .insert(customSkills)
        .values({
          companyId,
          slug,
          name: data.name,
          description: data.description ?? null,
          category: data.category ?? null,
          skillMdContent: data.skillMdContent ?? null,
          skillMdUrl: data.skillMdUrl ?? null,
          createdByUserId: userId ?? null,
        })
        .returning();
      return rows[0]!;
    },

    update: async (id: string, data: UpdateCustomSkill) => {
      const rows = await db
        .update(customSkills)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(customSkills.id, id))
        .returning();
      return rows[0] ?? null;
    },

    remove: async (id: string) => {
      const rows = await db
        .delete(customSkills)
        .where(eq(customSkills.id, id))
        .returning();
      return rows[0] ?? null;
    },
  };
}
