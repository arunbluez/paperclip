import { api } from "./client";
import type { McpServer, AgentMcpServer } from "@paperclipai/shared";

export interface McpServerWithCount extends McpServer {
  assignedAgentCount: number;
}

export const mcpServersApi = {
  list: (companyId: string) =>
    api.get<McpServerWithCount[]>(`/companies/${companyId}/mcp-servers`),

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<McpServer>(`/companies/${companyId}/mcp-servers`, data),

  get: (id: string) =>
    api.get<McpServer>(`/mcp-servers/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<McpServer>(`/mcp-servers/${id}`, data),

  remove: (id: string) =>
    api.delete(`/mcp-servers/${id}`),

  listForAgent: (agentId: string) =>
    api.get<AgentMcpServer[]>(`/agents/${agentId}/mcp-servers`),

  assignToAgent: (agentId: string, mcpServerId: string, config?: Record<string, unknown> | null) =>
    api.post<AgentMcpServer>(`/agents/${agentId}/mcp-servers`, { mcpServerId, config }),

  removeFromAgent: (agentId: string, mcpServerId: string) =>
    api.delete(`/agents/${agentId}/mcp-servers/${mcpServerId}`),

  agentMcpCounts: (companyId: string) =>
    api.get<Record<string, number>>(`/companies/${companyId}/agent-mcp-counts`),

  launchBrowser: (agentId: string) =>
    api.post<{ status: string; profileDir?: string }>(`/agents/${agentId}/browser/launch`, {}),

  stopBrowser: (agentId: string) =>
    api.post<{ status: string }>(`/agents/${agentId}/browser/stop`, {}),

  browserStatus: (agentId: string) =>
    api.get<{ running: boolean }>(`/agents/${agentId}/browser/status`),

  launchCdpChrome: () =>
    api.post<{ status: string; port?: number }>("/mcp-servers/cdp-chrome/launch", {}),

  stopCdpChrome: () =>
    api.post<{ status: string }>("/mcp-servers/cdp-chrome/stop", {}),

  cdpChromeStatus: () =>
    api.get<{ running: boolean; port: number | null }>("/mcp-servers/cdp-chrome/status"),
};
