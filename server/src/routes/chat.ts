import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createChatSessionSchema, sendChatMessageSchema, updateChatSessionSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { chatService } from "../services/chat.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function chatRoutes(db: Db) {
  const router = Router();
  const svc = chatService(db);

  // Active chat session counts by agent (for sidebar indicator)
  router.get("/companies/:companyId/chat/active-agents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const rows = await svc.activeSessionsByAgent(companyId);
    res.json(rows);
  });

  // Create a new chat session
  router.post("/companies/:companyId/agents/:agentId/chat/sessions", validate(createChatSessionSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const session = await svc.createSession(companyId, agentId, actor.actorId);
    res.status(201).json(session);
  });

  // List chat sessions for an agent
  router.get("/companies/:companyId/agents/:agentId/chat/sessions", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const status = (req.query.status as string) || undefined;
    const sessions = await svc.listSessions(companyId, agentId, status);
    res.json(sessions);
  });

  // Get a specific session with messages
  router.get("/chat/sessions/:sessionId", async (req, res) => {
    const sessionId = req.params.sessionId as string;
    assertBoard(req);
    const session = await svc.getSession(sessionId);
    assertCompanyAccess(req, session.companyId);
    res.json(session);
  });

  // Send a message (SSE streaming response)
  router.post("/chat/sessions/:sessionId/messages", validate(sendChatMessageSchema), async (req, res) => {
    const sessionId = req.params.sessionId as string;
    assertBoard(req);

    // Verify access before streaming
    const session = await svc.getSession(sessionId);
    assertCompanyAccess(req, session.companyId);

    // Set up SSE — disable compression and buffering for real-time streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Content-Encoding", "identity");
    res.flushHeaders();

    const sendSSE = (event: string, data: unknown) => {
      const ok = res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // Force flush if the underlying socket supports it
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    };

    try {
      await svc.sendMessage(sessionId, req.body.content, (event) => {
        sendSSE(event.type, event);
      });
    } catch (err) {
      sendSSE("error", {
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      res.end();
    }
  });

  // Update (archive) a session
  router.patch("/chat/sessions/:sessionId", validate(updateChatSessionSchema), async (req, res) => {
    const sessionId = req.params.sessionId as string;
    assertBoard(req);
    const existing = await svc.getSession(sessionId);
    assertCompanyAccess(req, existing.companyId);

    if (req.body.status === "archived") {
      const updated = await svc.archiveSession(sessionId);
      res.json(updated);
    } else {
      res.json(existing);
    }
  });

  return router;
}
