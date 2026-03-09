import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi, type ChatSessionWithMessages } from "../api/chat";
import type { ChatSession, ChatMessage, ChatStreamEvent } from "@paperclipai/shared";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownBody } from "./MarkdownBody";
import { AgentIcon } from "./AgentIconPicker";
import {
  Plus,
  Send,
  Loader2,
  MessageSquare,
  Archive,
  Wrench,
} from "lucide-react";

interface ChatPanelProps {
  agentId: string;
  agentName: string;
  agentIcon: string | null;
  companyId: string;
}

function appendMessage(
  old: ChatSessionWithMessages | undefined,
  sessionId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">,
): ChatSessionWithMessages | undefined {
  const entry: ChatMessage = {
    ...msg,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
  if (old) {
    return { ...old, messages: [...old.messages, entry] };
  }
  // No cache entry yet — create a minimal one so the message is visible
  return {
    id: sessionId,
    companyId: "",
    agentId: "",
    source: "web" as const,
    telegramChatId: null,
    title: null,
    status: "active" as const,
    claudeSessionId: null,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [entry],
  };
}

export function ChatPanel({ agentId, agentName, agentIcon, companyId }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolEvents, setToolEvents] = useState<ChatStreamEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // List sessions
  const sessionsQuery = useQuery({
    queryKey: queryKeys.chat.sessions(agentId),
    queryFn: () => chatApi.listSessions(companyId, agentId),
  });

  // Get selected session with messages
  const sessionQuery = useQuery({
    queryKey: queryKeys.chat.messages(selectedSessionId ?? ""),
    queryFn: () => chatApi.getSession(selectedSessionId!),
    enabled: !!selectedSessionId,
  });

  // Create session
  const createSession = useMutation({
    mutationFn: () => chatApi.createSession(companyId, agentId),
    onSuccess: (session) => {
      setSelectedSessionId(session.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(agentId) });
      inputRef.current?.focus();
    },
  });

  // Archive session
  const archiveSession = useMutation({
    mutationFn: (sessionId: string) => chatApi.archiveSession(sessionId),
    onSuccess: () => {
      setSelectedSessionId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(agentId) });
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [sessionQuery.data?.messages, streamingContent, scrollToBottom]);

  // Auto-select first session or create one
  useEffect(() => {
    if (!selectedSessionId && sessionsQuery.data && sessionsQuery.data.length > 0) {
      setSelectedSessionId(sessionsQuery.data[0].id);
    }
  }, [sessionsQuery.data, selectedSessionId]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    let sessionId = selectedSessionId;

    // Create session if none selected
    if (!sessionId) {
      const session = await createSession.mutateAsync();
      sessionId = session.id;
    }

    const messageContent = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setToolEvents([]);

    // Optimistically add user message to cache
    const cacheKey = queryKeys.chat.messages(sessionId);
    queryClient.setQueryData(cacheKey, (old: ChatSessionWithMessages | undefined) =>
      appendMessage(old, sessionId!, {
        sessionId: sessionId!,
        role: "user",
        content: messageContent,
        metadata: null,
      }),
    );

    try {
      const response = await chatApi.sendMessage(sessionId!, messageContent);
      if (!response.ok) {
        console.error("Chat send failed:", response.status, await response.text().catch(() => ""));
        return;
      }
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const event = JSON.parse(line.slice(6)) as ChatStreamEvent;
          if (event.type === "content_delta" && event.content) {
            fullContent += event.content;
            setStreamingContent(fullContent);
          } else if (event.type === "tool_use") {
            setToolEvents((prev) => [...prev, event]);
          } else if (event.type === "error") {
            console.error("Chat error:", event.error);
          }
        } catch {
          // Skip malformed events
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        processLine(buffer.trim());
      }

      // Stream ended — add assistant message to cache directly so it's
      // visible even if React batches the streaming state clear in the same tick
      if (fullContent) {
        queryClient.setQueryData(cacheKey, (old: ChatSessionWithMessages | undefined) =>
          appendMessage(old, sessionId!, {
            sessionId: sessionId!,
            role: "assistant",
            content: fullContent,
            metadata: null,
          }),
        );
      }

      // Refresh from server for authoritative data
      queryClient.invalidateQueries({ queryKey: cacheKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(agentId) });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setToolEvents([]);
    }
  };

  // Filter out empty assistant messages (from failed previous attempts)
  const messages = (sessionQuery.data?.messages ?? []).filter(
    (msg) => msg.role === "user" || (msg.content && msg.content.trim()),
  );
  const sessions = sessionsQuery.data ?? [];


  return (
    <div className="flex h-[calc(100vh-12rem)] border border-border rounded-lg overflow-hidden">
      {/* Session sidebar */}
      <div className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-2 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => createSession.mutate()}
            disabled={createSession.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-0.5">
            {sessions.map((session) => (
              <button
                key={session.id}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors",
                  selectedSessionId === session.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-muted-foreground",
                )}
                onClick={() => setSelectedSessionId(session.id)}
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {session.title || "New Chat"}
                  </span>
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No conversations yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {selectedSessionId && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              <AgentIcon icon={agentIcon} className="h-4 w-4" />
              <span>{agentName}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => archiveSession.mutate(selectedSessionId)}
              title="Archive session"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {!selectedSessionId && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-sm font-medium">Chat with {agentName}</p>
                <p className="text-xs mt-1">
                  Start a conversation to brainstorm, plan, and create work items.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                agentIcon={agentIcon}
              />
            ))}
            {/* Streaming response */}
            {isStreaming && (
              <>
                {toolEvents.map((event, i) => (
                  <ToolUseCard key={i} event={event} />
                ))}
                {streamingContent ? (
                  <ChatBubble
                    role="assistant"
                    content={streamingContent}
                    agentIcon={agentIcon}
                    isStreaming
                  />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{agentName} is thinking...</span>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${agentName}...`}
              disabled={isStreaming}
              className="flex-1"
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  agentIcon,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  agentIcon?: string | null;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground",
        )}
      >
        {isUser ? "You" : <AgentIcon icon={agentIcon ?? null} className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <MarkdownBody>{content}</MarkdownBody>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current opacity-50 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}

function ToolUseCard({ event }: { event: ChatStreamEvent }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
      <Wrench className="h-3 w-3 shrink-0" />
      <span className="font-medium">{event.toolName}</span>
      {event.toolInput && Object.keys(event.toolInput).length > 0 && (
        <span className="truncate opacity-75">
          {JSON.stringify(event.toolInput).slice(0, 80)}
        </span>
      )}
    </div>
  );
}
