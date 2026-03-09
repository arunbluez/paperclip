export interface ChatSession {
  id: string;
  companyId: string;
  agentId: string;
  source: "web" | "telegram";
  telegramChatId: string | null;
  title: string | null;
  status: "active" | "archived";
  claudeSessionId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type ChatStreamEventType = "content_delta" | "tool_use" | "message_complete" | "error";

export interface ChatStreamEvent {
  type: ChatStreamEventType;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  messageId?: string;
  error?: string;
}
