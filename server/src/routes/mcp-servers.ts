import { Router } from "express";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Db } from "@paperclipai/db";
import { createMcpServerSchema, updateMcpServerSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { mcpServerService, agentService } from "../services/index.js";
import { notFound, forbidden } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

const BROWSER_PROFILES_BASE = path.join(os.homedir(), ".paperclip", "browser-profiles");
const CDP_CHROME_PROFILE = path.join(os.homedir(), ".paperclip", "cdp-chrome-profile");

// Track running browser processes per agent
const runningBrowsers = new Map<string, { process: ReturnType<typeof spawn>; profileDir: string }>();

// Track the CDP Chrome instance (company-wide, shared across agents)
let cdpChrome: { process: ReturnType<typeof spawn>; port: number } | null = null;

function findChromeBinary(): string {
  // Prefer common binary names in order
  const candidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
  ];
  // On Linux, just return the first candidate — spawn will fail with a clear error if not found
  return candidates[0];
}

export function mcpServerRoutes(db: Db) {
  const router = Router();
  const svc = mcpServerService(db);
  const agentSvc = agentService(db);

  // --- Company MCP Server Management ---

  router.get("/companies/:companyId/mcp-servers", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId as string);

    // Ensure builtin servers exist
    await svc.ensureBuiltinServers(req.params.companyId as string);

    const servers = await svc.list(req.params.companyId as string);
    const agentCounts = await svc.countByServer(req.params.companyId as string);
    res.json(servers.map((s) => ({ ...s, assignedAgentCount: agentCounts[s.id] ?? 0 })));
  });

  router.post(
    "/companies/:companyId/mcp-servers",
    validate(createMcpServerSchema),
    async (req, res) => {
      assertBoard(req);
      assertCompanyAccess(req, req.params.companyId as string);
      const server = await svc.create(
        req.params.companyId as string,
        req.body,
        req.actor?.userId ?? null,
      );
      res.status(201).json(server);
    },
  );

  router.get("/mcp-servers/:id", async (req, res) => {
    assertBoard(req);
    const server = await svc.get(req.params.id as string);
    if (!server) throw notFound("MCP server not found");
    assertCompanyAccess(req, server.companyId);
    res.json(server);
  });

  router.patch(
    "/mcp-servers/:id",
    validate(updateMcpServerSchema),
    async (req, res) => {
      assertBoard(req);
      const server = await svc.get(req.params.id as string);
      if (!server) throw notFound("MCP server not found");
      assertCompanyAccess(req, server.companyId);
      const updated = await svc.update(req.params.id as string, req.body);
      res.json(updated);
    },
  );

  router.delete("/mcp-servers/:id", async (req, res) => {
    assertBoard(req);
    const server = await svc.get(req.params.id as string);
    if (!server) throw notFound("MCP server not found");
    assertCompanyAccess(req, server.companyId);
    if (server.builtin) throw forbidden("Cannot delete built-in MCP servers");
    await svc.remove(req.params.id as string);
    res.json({ ok: true });
  });

  // --- Agent MCP counts per agent (for OrgChart badges) ---

  router.get("/companies/:companyId/agent-mcp-counts", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId as string);
    const counts = await svc.countByAgent(req.params.companyId as string);
    res.json(counts);
  });

  // --- Agent MCP Assignment ---

  router.get("/agents/:agentId/mcp-servers", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);
    const assignments = await svc.listForAgent(req.params.agentId as string);
    res.json(assignments);
  });

  router.post("/agents/:agentId/mcp-servers", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);

    const { mcpServerId, config } = req.body;
    if (!mcpServerId) { res.status(400).json({ error: "mcpServerId is required" }); return; }

    const server = await svc.get(mcpServerId);
    if (!server) throw notFound("MCP server not found");
    if (server.companyId !== agent.companyId) throw forbidden("MCP server belongs to a different company");

    const assignment = await svc.assignToAgent(
      req.params.agentId as string,
      mcpServerId,
      agent.companyId,
      config,
    );
    res.status(201).json(assignment);
  });

  router.delete("/agents/:agentId/mcp-servers/:mcpServerId", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);

    await svc.removeFromAgent(req.params.agentId as string, req.params.mcpServerId as string);
    res.json({ ok: true });
  });

  // --- CDP Chrome Management (for "Real Chrome" MCP server) ---

  router.post("/mcp-servers/cdp-chrome/launch", async (req, res) => {
    assertBoard(req);
    if (cdpChrome) {
      res.json({ status: "already_running", port: cdpChrome.port });
      return;
    }

    const port = 9222;
    await fs.mkdir(CDP_CHROME_PROFILE, { recursive: true });

    const chrome = findChromeBinary();
    const child = spawn(chrome, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${CDP_CHROME_PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
    ], {
      stdio: "ignore",
      detached: true,
    });
    child.unref();

    cdpChrome = { process: child, port };

    child.on("exit", () => {
      cdpChrome = null;
    });

    res.json({ status: "launched", port });
  });

  router.post("/mcp-servers/cdp-chrome/stop", async (req, res) => {
    assertBoard(req);
    if (!cdpChrome) {
      res.json({ status: "not_running" });
      return;
    }

    cdpChrome.process.kill("SIGTERM");
    cdpChrome = null;
    res.json({ status: "stopped" });
  });

  router.get("/mcp-servers/cdp-chrome/status", async (_req, res) => {
    res.json({ running: !!cdpChrome, port: cdpChrome?.port ?? null });
  });

  // --- Browser Session Management ---

  router.post("/agents/:agentId/browser/launch", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);

    const agentId = req.params.agentId as string;
    if (runningBrowsers.has(agentId)) {
      res.json({ status: "already_running" });
      return;
    }

    const profileDir = path.join(BROWSER_PROFILES_BASE, agentId);
    await fs.mkdir(profileDir, { recursive: true });

    // Launch headed Playwright browser for manual login
    const child = spawn("npx", ["-y", "@playwright/mcp@latest", "--user-data-dir", profileDir], {
      stdio: "ignore",
      detached: true,
    });
    child.unref();

    runningBrowsers.set(agentId, { process: child, profileDir });

    child.on("exit", () => {
      runningBrowsers.delete(agentId);
    });

    res.json({ status: "launched", profileDir });
  });

  router.post("/agents/:agentId/browser/stop", async (req, res) => {
    assertBoard(req);
    const agentId = req.params.agentId as string;
    const entry = runningBrowsers.get(agentId);
    if (!entry) {
      res.json({ status: "not_running" });
      return;
    }

    entry.process.kill("SIGTERM");
    runningBrowsers.delete(agentId);
    res.json({ status: "stopped" });
  });

  router.get("/agents/:agentId/browser/status", async (req, res) => {
    const agentId = req.params.agentId as string;
    const running = runningBrowsers.has(agentId);
    res.json({ running });
  });

  return router;
}
