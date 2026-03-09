import type { CompanyStatus } from "../constants.js";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  requireBoardApprovalForNewAgents: boolean;
  brandColor: string | null;
  telegramDashboardBotToken: string | null;
  telegramDashboardChatId: string | null;
  telegramDashboardBotUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}
