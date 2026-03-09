import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createCustomSkillSchema, updateCustomSkillSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { customSkillService } from "../services/index.js";
import { notFound } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function customSkillRoutes(db: Db) {
  const router = Router();
  const svc = customSkillService(db);

  // List custom skills for a company
  router.get("/companies/:companyId/custom-skills", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId as string);
    const skills = await svc.list(req.params.companyId as string);
    res.json(skills);
  });

  // Create a custom skill
  router.post(
    "/companies/:companyId/custom-skills",
    validate(createCustomSkillSchema),
    async (req, res) => {
      assertBoard(req);
      assertCompanyAccess(req, req.params.companyId as string);
      const userId = (req as any).session?.user?.id ?? null;
      const skill = await svc.create(req.params.companyId as string, req.body, userId);
      res.status(201).json(skill);
    },
  );

  // Update a custom skill
  router.patch(
    "/custom-skills/:id",
    validate(updateCustomSkillSchema),
    async (req, res) => {
      assertBoard(req);
      const existing = await svc.getById(req.params.id as string);
      if (!existing) throw notFound("Custom skill not found");
      assertCompanyAccess(req, existing.companyId);
      const updated = await svc.update(req.params.id as string, req.body);
      res.json(updated);
    },
  );

  // Delete a custom skill
  router.delete("/custom-skills/:id", async (req, res) => {
    assertBoard(req);
    const existing = await svc.getById(req.params.id as string);
    if (!existing) throw notFound("Custom skill not found");
    assertCompanyAccess(req, existing.companyId);
    await svc.remove(req.params.id as string);
    res.json({ ok: true });
  });

  return router;
}
