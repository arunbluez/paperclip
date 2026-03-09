import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assignSkillSchema, SKILL_CATALOG } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { skillService, agentService } from "../services/index.js";
import { notFound } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function skillRoutes(db: Db) {
  const router = Router();
  const svc = skillService(db);
  const agentSvc = agentService(db);

  // Return the hardcoded skill catalog
  router.get("/skill-catalog", (_req, res) => {
    res.json(SKILL_CATALOG);
  });

  // List all skills across a company (for OrgChart badges)
  router.get("/companies/:companyId/agent-skills", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId as string);
    const skills = await svc.listForCompany(req.params.companyId as string);
    res.json(skills);
  });

  // List skills assigned to an agent
  router.get("/agents/:agentId/skills", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);
    const skills = await svc.listForAgent(req.params.agentId as string);
    res.json(skills);
  });

  // Assign a skill to an agent
  router.post(
    "/agents/:agentId/skills",
    validate(assignSkillSchema),
    async (req, res) => {
      assertBoard(req);
      const agent = await agentSvc.getById(req.params.agentId as string);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(req, agent.companyId);

      const result = await svc.assignToAgent(
        req.params.agentId as string,
        agent.companyId,
        req.body,
      );
      res.status(201).json(result);
    },
  );

  // Remove a skill from an agent
  router.delete("/agents/:agentId/skills/:skillSlug", async (req, res) => {
    assertBoard(req);
    const agent = await agentSvc.getById(req.params.agentId as string);
    if (!agent) throw notFound("Agent not found");
    assertCompanyAccess(req, agent.companyId);

    await svc.removeFromAgent(req.params.agentId as string, req.params.skillSlug as string);
    res.json({ ok: true });
  });

  return router;
}
