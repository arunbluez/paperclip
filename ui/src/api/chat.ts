import { api } from "./client";
import type { ChatSession, ChatMessage } from "@paperclipai/shared";

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

export interface ActiveChatAgent {
  agentId: string;
  count: number;
}

export const chatApi = {
  activeChatAgents: (companyId: string) =>
    api.get<ActiveChatAgent[]>(`/companies/${companyId}/chat/active-agents`),

  createSession: (companyId: string, agentId: string) =>
    api.post<ChatSession>(`/companies/${companyId}/agents/${agentId}/chat/sessions`, { agentId }),

  listSessions: (companyId: string, agentId: string, status?: string) => {
    const params = status ? `?status=${status}` : "";
    return api.get<ChatSession[]>(`/companies/${companyId}/agents/${agentId}/chat/sessions${params}`);
  },

  getSession: (sessionId: string) =>
    api.get<ChatSessionWithMessages>(`/chat/sessions/${sessionId}`),

  archiveSession: (sessionId: string) =>
    api.patch<ChatSession>(`/chat/sessions/${sessionId}`, { status: "archived" }),

  sendMessage: (sessionId: string, content: string): Promise<Response> =>
    fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    }),
};
