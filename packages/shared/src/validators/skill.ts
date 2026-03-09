import { z } from "zod";

export const assignSkillSchema = z.object({
  skillSlug: z.string().min(1),
  skillName: z.string().min(1),
  skillDescription: z.string().optional().nullable(),
  skillCategory: z.string().optional().nullable(),
  sourceUrl: z.string().min(1),
});

export type AssignSkill = z.infer<typeof assignSkillSchema>;

export const createCustomSkillSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  skillMdContent: z.string().max(50000).optional().nullable(),
  skillMdUrl: z.string().url().optional().nullable(),
});

export type CreateCustomSkill = z.infer<typeof createCustomSkillSchema>;

export const updateCustomSkillSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  skillMdContent: z.string().max(50000).optional().nullable(),
  skillMdUrl: z.string().url().optional().nullable(),
});

export type UpdateCustomSkill = z.infer<typeof updateCustomSkillSchema>;
