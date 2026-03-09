import { z } from "zod";

export const createChatSessionSchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().optional().nullable(),
});

export type CreateChatSession = z.infer<typeof createChatSessionSchema>;

export const sendChatMessageSchema = z.object({
  content: z.string().min(1),
});

export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;

export const updateChatSessionSchema = z.object({
  status: z.enum(["active", "archived"]).optional(),
  title: z.string().optional().nullable(),
});

export type UpdateChatSession = z.infer<typeof updateChatSessionSchema>;
