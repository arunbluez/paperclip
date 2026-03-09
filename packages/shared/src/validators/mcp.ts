import { z } from "zod";

export const createMcpServerSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().nullable(),
  transport: z.enum(["stdio", "http", "sse", "managed-sse"]),
  command: z.string().optional().nullable(),
  args: z.array(z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
  headers: z.record(z.string()).optional().nullable(),
  env: z.record(z.string()).optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
});

export type CreateMcpServer = z.infer<typeof createMcpServerSchema>;

export const updateMcpServerSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  transport: z.enum(["stdio", "http", "sse", "managed-sse"]).optional(),
  command: z.string().optional().nullable(),
  args: z.array(z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
  headers: z.record(z.string()).optional().nullable(),
  env: z.record(z.string()).optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
  status: z.enum(["active", "disabled"]).optional(),
});

export type UpdateMcpServer = z.infer<typeof updateMcpServerSchema>;

export const assignMcpServerSchema = z.object({
  mcpServerId: z.string().uuid(),
  config: z.record(z.unknown()).optional().nullable(),
});

export type AssignMcpServer = z.infer<typeof assignMcpServerSchema>;
