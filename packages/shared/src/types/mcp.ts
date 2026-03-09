export interface McpServer {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  transport: "stdio" | "http" | "sse" | "managed-sse";
  command: string | null;
  args: string[] | null;
  url: string | null;
  headers: Record<string, string> | null;
  env: Record<string, string> | null;
  config: Record<string, unknown> | null;
  builtin: boolean;
  status: "active" | "disabled";
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMcpServer {
  agentId: string;
  mcpServerId: string;
  companyId: string;
  config: Record<string, unknown> | null;
  createdAt: Date;
  mcpServer?: McpServer;
}
