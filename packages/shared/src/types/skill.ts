export interface AgentSkill {
  id: string;
  agentId: string;
  companyId: string;
  skillSlug: string;
  skillName: string;
  skillDescription: string | null;
  skillCategory: string | null;
  sourceUrl: string;
  createdAt: Date;
}

export interface SkillCatalogEntry {
  slug: string;
  name: string;
  description: string;
  category: string;
  sourceUrl: string;
  skillMdUrl: string;
}

export interface CustomSkill {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  skillMdContent: string | null;
  skillMdUrl: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
