import { api } from "./client";
import type { AgentSkill, SkillCatalogEntry, CustomSkill } from "@paperclipai/shared";

export const skillsApi = {
  catalog: () =>
    api.get<SkillCatalogEntry[]>("/skill-catalog"),

  listForAgent: (agentId: string) =>
    api.get<AgentSkill[]>(`/agents/${agentId}/skills`),

  listForCompany: (companyId: string) =>
    api.get<AgentSkill[]>(`/companies/${companyId}/agent-skills`),

  assignToAgent: (agentId: string, data: {
    skillSlug: string;
    skillName: string;
    skillDescription?: string | null;
    skillCategory?: string | null;
    sourceUrl: string;
  }) =>
    api.post<AgentSkill>(`/agents/${agentId}/skills`, data),

  removeFromAgent: (agentId: string, skillSlug: string) =>
    api.delete(`/agents/${agentId}/skills/${encodeURIComponent(skillSlug)}`),

  // Custom skills (company-level)
  listCustom: (companyId: string) =>
    api.get<CustomSkill[]>(`/companies/${companyId}/custom-skills`),

  createCustom: (companyId: string, data: {
    name: string;
    description?: string | null;
    category?: string | null;
    skillMdContent?: string | null;
    skillMdUrl?: string | null;
  }) =>
    api.post<CustomSkill>(`/companies/${companyId}/custom-skills`, data),

  updateCustom: (id: string, data: {
    name?: string;
    description?: string | null;
    category?: string | null;
    skillMdContent?: string | null;
    skillMdUrl?: string | null;
  }) =>
    api.patch<CustomSkill>(`/custom-skills/${id}`, data),

  removeCustom: (id: string) =>
    api.delete(`/custom-skills/${id}`),
};
