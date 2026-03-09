import type { SkillCatalogEntry } from "./types/skill.js";

/**
 * Derive the raw GitHub URL to a SKILL.md file from a GitHub tree/blob URL.
 */
function ghRaw(treeUrl: string): string {
  return treeUrl
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/tree/", "/")
    .replace("/blob/", "/")
    .replace(/\/$/, "") + "/SKILL.md";
}

/** Shorthand for skills in the ComposioHQ/awesome-claude-skills repo */
function composio(folder: string): { sourceUrl: string; skillMdUrl: string } {
  const sourceUrl = `https://github.com/ComposioHQ/awesome-claude-skills/tree/master/${folder}`;
  return { sourceUrl, skillMdUrl: ghRaw(sourceUrl) };
}

/** Shorthand for skills in the anthropics/skills repo */
function anthropic(folder: string): { sourceUrl: string; skillMdUrl: string } {
  const sourceUrl = `https://github.com/anthropics/skills/tree/main/skills/${folder}`;
  return { sourceUrl, skillMdUrl: ghRaw(sourceUrl) };
}

/** Shorthand for external GitHub repos */
function ext(url: string): { sourceUrl: string; skillMdUrl: string } {
  return { sourceUrl: url, skillMdUrl: ghRaw(url) };
}

/**
 * Hardcoded catalog of Claude Code skills sourced from
 * https://github.com/ComposioHQ/awesome-claude-skills
 */
export const SKILL_CATALOG: SkillCatalogEntry[] = [
  // ── Document Processing ──────────────────────────────────────────────
  { slug: "docx", name: "DOCX Processing", description: "Create, edit, analyze Word docs with tracked changes, comments, formatting.", category: "Document Processing", ...anthropic("docx") },
  { slug: "pdf", name: "PDF Processing", description: "Extract text, tables, metadata, merge & annotate PDFs.", category: "Document Processing", ...anthropic("pdf") },
  { slug: "pptx", name: "PPTX Processing", description: "Read, generate, and adjust slides, layouts, templates.", category: "Document Processing", ...anthropic("pptx") },
  { slug: "xlsx", name: "XLSX Processing", description: "Spreadsheet manipulation: formulas, charts, data transformations.", category: "Document Processing", ...anthropic("xlsx") },
  { slug: "claude-epub-skill", name: "Markdown to EPUB Converter", description: "Converts markdown documents and chat summaries into professional EPUB ebook files.", category: "Document Processing", ...ext("https://github.com/smerchek/claude-epub-skill") },

  // ── Development & Code Tools ─────────────────────────────────────────
  { slug: "artifacts-builder", name: "Artifacts Builder", description: "Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using React, Tailwind CSS, shadcn/ui.", category: "Development & Code Tools", ...anthropic("web-artifacts-builder") },
  { slug: "aws-skills", name: "AWS Skills", description: "AWS development with CDK best practices, cost optimization, and serverless/event-driven architecture patterns.", category: "Development & Code Tools", ...ext("https://github.com/zxkane/aws-skills") },
  { slug: "changelog-generator", name: "Changelog Generator", description: "Automatically creates user-facing changelogs from git commits by analyzing history.", category: "Development & Code Tools", ...composio("changelog-generator") },
  { slug: "claude-code-terminal-title", name: "Claude Code Terminal Title", description: "Gives each Claude Code terminal window a dynamic title describing the work being done.", category: "Development & Code Tools", ...ext("https://github.com/bluzername/claude-code-terminal-title") },
  { slug: "d3js-visualization", name: "D3.js Visualization", description: "Teaches Claude to produce D3 charts and interactive data visualizations.", category: "Development & Code Tools", ...ext("https://github.com/chrisvoncsefalvay/claude-d3js-skill") },
  { slug: "ffuf-web-fuzzing", name: "FFUF Web Fuzzing", description: "Integrates the ffuf web fuzzer so Claude can run fuzzing tasks and analyze results.", category: "Development & Code Tools", ...ext("https://github.com/jthack/ffuf_claude_skill") },
  { slug: "finishing-a-development-branch", name: "Finishing a Development Branch", description: "Guides completion of development work by presenting clear options and handling chosen workflow.", category: "Development & Code Tools", ...ext("https://github.com/obra/superpowers/tree/main/skills/finishing-a-development-branch") },
  { slug: "ios-simulator", name: "iOS Simulator", description: "Enables Claude to interact with iOS Simulator for testing and debugging iOS applications.", category: "Development & Code Tools", ...ext("https://github.com/conorluddy/ios-simulator-skill") },
  { slug: "jules", name: "Jules AI Agent", description: "Delegate coding tasks to Google Jules AI agent for async bug fixes, documentation, tests.", category: "Development & Code Tools", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills/jules") },
  { slug: "langsmith-fetch", name: "LangSmith Fetch", description: "Debug LangChain and LangGraph agents by fetching and analyzing execution traces from LangSmith.", category: "Development & Code Tools", ...composio("langsmith-fetch") },
  { slug: "mcp-builder", name: "MCP Builder", description: "Guides creation of high-quality MCP servers for integrating external APIs and services with LLMs.", category: "Development & Code Tools", ...composio("mcp-builder") },
  { slug: "move-code-quality", name: "Move Code Quality", description: "Analyzes Move language packages against the official Move Book Code Quality Checklist.", category: "Development & Code Tools", ...ext("https://github.com/1NickPappas/move-code-quality-skill") },
  { slug: "playwright-skill", name: "Playwright Browser Automation", description: "Model-invoked Playwright automation for testing and validating web applications.", category: "Development & Code Tools", ...ext("https://github.com/lackeyjb/playwright-skill") },
  { slug: "prompt-engineering", name: "Prompt Engineering", description: "Teaches well-known prompt engineering techniques and patterns, including Anthropic best practices.", category: "Development & Code Tools", ...ext("https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/customaize-agent/skills/prompt-engineering") },
  { slug: "pypict-claude-skill", name: "PICT Test Case Design", description: "Design comprehensive test cases using PICT for pairwise coverage.", category: "Development & Code Tools", ...ext("https://github.com/omkamal/pypict-claude-skill") },
  { slug: "reddit-fetch", name: "Reddit Fetch", description: "Fetches Reddit content via Gemini CLI when WebFetch is blocked or returns 403 errors.", category: "Development & Code Tools", ...ext("https://github.com/ykdojo/claude-code-tips/tree/main/skills/reddit-fetch") },
  { slug: "skill-creator", name: "Skill Creator", description: "Provides guidance for creating effective Claude Skills with specialized knowledge and tool integrations.", category: "Development & Code Tools", ...composio("skill-creator") },
  { slug: "skill-seekers", name: "Skill Seekers", description: "Automatically converts any documentation website into a Claude AI skill in minutes.", category: "Development & Code Tools", ...ext("https://github.com/yusufkaraaslan/Skill_Seekers") },
  { slug: "software-architecture", name: "Software Architecture", description: "Implements design patterns including Clean Architecture, SOLID principles, and comprehensive best practices.", category: "Development & Code Tools", ...ext("https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/ddd/skills/software-architecture") },
  { slug: "subagent-driven-development", name: "Subagent-Driven Development", description: "Dispatches independent subagents for individual tasks with code review checkpoints.", category: "Development & Code Tools", ...ext("https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/sadd/skills/subagent-driven-development") },
  { slug: "test-driven-development", name: "Test-Driven Development", description: "Use when implementing any feature or bugfix, before writing implementation code.", category: "Development & Code Tools", ...ext("https://github.com/obra/superpowers/tree/main/skills/test-driven-development") },
  { slug: "using-git-worktrees", name: "Using Git Worktrees", description: "Creates isolated git worktrees with smart directory selection and safety verification.", category: "Development & Code Tools", ...ext("https://github.com/obra/superpowers/tree/main/skills/using-git-worktrees") },
  { slug: "connect", name: "Connect Apps", description: "Connect Claude to any app. Send emails, create issues, post messages across 1000+ services.", category: "Development & Code Tools", ...composio("connect") },
  { slug: "webapp-testing", name: "Webapp Testing", description: "Tests local web applications using Playwright for verifying frontend functionality.", category: "Development & Code Tools", ...composio("webapp-testing") },

  // ── Data & Analysis ──────────────────────────────────────────────────
  { slug: "csv-data-summarizer", name: "CSV Data Summarizer", description: "Automatically analyzes CSV files and generates comprehensive insights with visualizations.", category: "Data & Analysis", ...ext("https://github.com/coffeefuelbump/csv-data-summarizer-claude-skill") },
  { slug: "deep-research", name: "Deep Research", description: "Execute autonomous multi-step research using Gemini Deep Research Agent.", category: "Data & Analysis", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills/deep-research") },
  { slug: "postgres", name: "PostgreSQL Queries", description: "Execute safe read-only SQL queries against PostgreSQL databases with multi-connection support.", category: "Data & Analysis", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills/postgres") },
  { slug: "root-cause-tracing", name: "Root Cause Tracing", description: "Use when errors occur deep in execution and you need to trace back to find the original trigger.", category: "Data & Analysis", ...ext("https://github.com/obra/superpowers/tree/main/skills/root-cause-tracing") },

  // ── Business & Marketing ─────────────────────────────────────────────
  { slug: "brand-guidelines", name: "Brand Guidelines", description: "Applies brand colors and typography to artifacts for consistent visual identity.", category: "Business & Marketing", ...composio("brand-guidelines") },
  { slug: "competitive-ads-extractor", name: "Competitive Ads Extractor", description: "Extracts and analyzes competitors' ads from ad libraries.", category: "Business & Marketing", ...composio("competitive-ads-extractor") },
  { slug: "domain-name-brainstormer", name: "Domain Name Brainstormer", description: "Generates creative domain name ideas and checks availability across multiple TLDs.", category: "Business & Marketing", ...composio("domain-name-brainstormer") },
  { slug: "internal-comms", name: "Internal Comms", description: "Helps write internal communications including 3P updates, newsletters, FAQs, and status reports.", category: "Business & Marketing", ...composio("internal-comms") },
  { slug: "lead-research-assistant", name: "Lead Research Assistant", description: "Identifies and qualifies high-quality leads by analyzing your product and searching for targets.", category: "Business & Marketing", ...composio("lead-research-assistant") },

  // ── Communication & Writing ──────────────────────────────────────────
  { slug: "article-extractor", name: "Article Extractor", description: "Extract full article text and metadata from web pages.", category: "Communication & Writing", ...ext("https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/article-extractor") },
  { slug: "brainstorming", name: "Brainstorming", description: "Transform rough ideas into fully-formed designs through structured questioning.", category: "Communication & Writing", ...ext("https://github.com/obra/superpowers/tree/main/skills/brainstorming") },
  { slug: "content-research-writer", name: "Content Research Writer", description: "Assists in writing high-quality content by conducting research, adding citations.", category: "Communication & Writing", ...composio("content-research-writer") },
  { slug: "family-history-research", name: "Family History Research", description: "Provides assistance with planning family history and genealogy research projects.", category: "Communication & Writing", ...ext("https://github.com/emaynard/claude-family-history-research-skill") },
  { slug: "meeting-insights-analyzer", name: "Meeting Insights Analyzer", description: "Analyzes meeting transcripts to uncover behavioral patterns and leadership style.", category: "Communication & Writing", ...composio("meeting-insights-analyzer") },
  { slug: "notebooklm-skill", name: "NotebookLM Integration", description: "Lets Claude Code chat directly with NotebookLM for source-grounded answers.", category: "Communication & Writing", ...ext("https://github.com/PleasePrompto/notebooklm-skill") },
  { slug: "twitter-algorithm-optimizer", name: "Twitter Algorithm Optimizer", description: "Analyze and optimize tweets for maximum reach using Twitter's open-source algorithm insights.", category: "Communication & Writing", ...composio("twitter-algorithm-optimizer") },

  // ── Creative & Media ─────────────────────────────────────────────────
  { slug: "canvas-design", name: "Canvas Design", description: "Creates beautiful visual art in PNG and PDF documents using design philosophy.", category: "Creative & Media", ...composio("canvas-design") },
  { slug: "imagen", name: "Imagen", description: "Generate images using Google Gemini's image generation API for mockups, icons, illustrations.", category: "Creative & Media", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills/imagen") },
  { slug: "image-enhancer", name: "Image Enhancer", description: "Improves image and screenshot quality by enhancing resolution, sharpness, and clarity.", category: "Creative & Media", ...composio("image-enhancer") },
  { slug: "slack-gif-creator", name: "Slack GIF Creator", description: "Creates animated GIFs optimized for Slack with validators for size constraints.", category: "Creative & Media", ...composio("slack-gif-creator") },
  { slug: "theme-factory", name: "Theme Factory", description: "Applies professional font and color themes to artifacts with 10 pre-set themes.", category: "Creative & Media", ...composio("theme-factory") },
  { slug: "video-downloader", name: "Video Downloader", description: "Downloads videos from YouTube and other platforms for offline viewing.", category: "Creative & Media", ...composio("video-downloader") },
  { slug: "youtube-transcript", name: "YouTube Transcript", description: "Fetch transcripts from YouTube videos and prepare summaries.", category: "Creative & Media", ...ext("https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/youtube-transcript") },

  // ── Productivity & Organization ──────────────────────────────────────
  { slug: "file-organizer", name: "File Organizer", description: "Intelligently organizes files and folders by understanding context and finding duplicates.", category: "Productivity & Organization", ...composio("file-organizer") },
  { slug: "invoice-organizer", name: "Invoice Organizer", description: "Automatically organizes invoices and receipts for tax preparation.", category: "Productivity & Organization", ...composio("invoice-organizer") },
  { slug: "kaizen", name: "Kaizen", description: "Applies continuous improvement methodology based on Japanese Kaizen philosophy.", category: "Productivity & Organization", ...ext("https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/kaizen/skills/kaizen") },
  { slug: "n8n-skills", name: "n8n Skills", description: "Enables AI assistants to directly understand and operate n8n workflows.", category: "Productivity & Organization", ...ext("https://github.com/haunchen/n8n-skills") },
  { slug: "raffle-winner-picker", name: "Raffle Winner Picker", description: "Randomly selects winners from lists with cryptographically secure randomness.", category: "Productivity & Organization", ...composio("raffle-winner-picker") },
  { slug: "tailored-resume-generator", name: "Tailored Resume Generator", description: "Analyzes job descriptions and generates tailored resumes to maximize interview chances.", category: "Productivity & Organization", ...composio("tailored-resume-generator") },
  { slug: "ship-learn-next", name: "Ship-Learn-Next", description: "Skill to help iterate on what to build or learn next, based on feedback loops.", category: "Productivity & Organization", ...ext("https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/ship-learn-next") },
  { slug: "tapestry", name: "Tapestry", description: "Interlink and summarize related documents into knowledge networks.", category: "Productivity & Organization", ...ext("https://github.com/michalparkola/tapestry-skills-for-claude-code/tree/main/tapestry") },

  // ── Collaboration & Project Management ───────────────────────────────
  { slug: "git-pushing", name: "Git Pushing", description: "Automate git operations and repository interactions.", category: "Collaboration & Project Management", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/engineering-workflow-plugin/skills/git-pushing") },
  { slug: "google-workspace", name: "Google Workspace", description: "Suite of Google Workspace integrations: Gmail, Calendar, Chat, Docs, Sheets, Slides, Drive.", category: "Collaboration & Project Management", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills") },
  { slug: "outline", name: "Outline Wiki", description: "Search, read, create, and manage documents in Outline wiki instances.", category: "Collaboration & Project Management", ...ext("https://github.com/sanjay3290/ai-skills/tree/main/skills/outline") },
  { slug: "review-implementing", name: "Review Implementing", description: "Evaluate code implementation plans and align with specs.", category: "Collaboration & Project Management", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/engineering-workflow-plugin/skills/review-implementing") },
  { slug: "test-fixing", name: "Test Fixing", description: "Detect failing tests and propose patches or fixes.", category: "Collaboration & Project Management", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/engineering-workflow-plugin/skills/test-fixing") },

  // ── Security & Systems ───────────────────────────────────────────────
  { slug: "computer-forensics", name: "Computer Forensics", description: "Digital forensics analysis and investigation techniques.", category: "Security & Systems", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/computer-forensics-skills/skills/computer-forensics") },
  { slug: "file-deletion", name: "Secure File Deletion", description: "Secure file deletion and data sanitization methods.", category: "Security & Systems", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/computer-forensics-skills/skills/file-deletion") },
  { slug: "metadata-extraction", name: "Metadata Extraction", description: "Extract and analyze file metadata for forensic purposes.", category: "Security & Systems", ...ext("https://github.com/mhattingpete/claude-skills-marketplace/tree/main/computer-forensics-skills/skills/metadata-extraction") },
  { slug: "threat-hunting-sigma", name: "Threat Hunting with Sigma Rules", description: "Use Sigma detection rules to hunt for threats and analyze security events.", category: "Security & Systems", ...ext("https://github.com/jthack/threat-hunting-with-sigma-rules-skill") },

  // ── App Automation via Composio ── CRM & Sales ───────────────────────
  { slug: "close-automation", name: "Close CRM Automation", description: "Automate Close CRM: leads, contacts, opportunities, activities, and pipelines.", category: "CRM & Sales", ...composio("composio-skills/close-automation") },
  { slug: "hubspot-automation", name: "HubSpot Automation", description: "Automate HubSpot CRM: contacts, deals, companies, tickets, and email engagement.", category: "CRM & Sales", ...composio("composio-skills/hubspot-automation") },
  { slug: "pipedrive-automation", name: "Pipedrive Automation", description: "Automate Pipedrive: deals, contacts, organizations, activities, and pipelines.", category: "CRM & Sales", ...composio("composio-skills/pipedrive-automation") },
  { slug: "salesforce-automation", name: "Salesforce Automation", description: "Automate Salesforce: objects, records, SOQL queries, and bulk operations.", category: "CRM & Sales", ...composio("composio-skills/salesforce-automation") },
  { slug: "zoho-crm-automation", name: "Zoho CRM Automation", description: "Automate Zoho CRM: leads, contacts, deals, accounts, and modules.", category: "CRM & Sales", ...composio("composio-skills/zoho-crm-automation") },

  // ── Project Management ───────────────────────────────────────────────
  { slug: "asana-automation", name: "Asana Automation", description: "Automate Asana: tasks, projects, sections, assignments, and workspaces.", category: "Project Management", ...composio("composio-skills/asana-automation") },
  { slug: "basecamp-automation", name: "Basecamp Automation", description: "Automate Basecamp: to-do lists, messages, people, groups, and projects.", category: "Project Management", ...composio("composio-skills/basecamp-automation") },
  { slug: "clickup-automation", name: "ClickUp Automation", description: "Automate ClickUp: tasks, lists, spaces, goals, and time tracking.", category: "Project Management", ...composio("composio-skills/clickup-automation") },
  { slug: "jira-automation", name: "Jira Automation", description: "Automate Jira: issues, projects, boards, sprints, and JQL queries.", category: "Project Management", ...composio("composio-skills/jira-automation") },
  { slug: "linear-automation", name: "Linear Automation", description: "Automate Linear: issues, projects, cycles, teams, and workflows.", category: "Project Management", ...composio("composio-skills/linear-automation") },
  { slug: "monday-automation", name: "Monday.com Automation", description: "Automate Monday.com: boards, items, columns, groups, and workspaces.", category: "Project Management", ...composio("composio-skills/monday-automation") },
  { slug: "notion-automation", name: "Notion Automation", description: "Automate Notion: pages, databases, blocks, comments, and search.", category: "Project Management", ...composio("composio-skills/notion-automation") },
  { slug: "todoist-automation", name: "Todoist Automation", description: "Automate Todoist: tasks, projects, sections, labels, and filters.", category: "Project Management", ...composio("composio-skills/todoist-automation") },
  { slug: "trello-automation", name: "Trello Automation", description: "Automate Trello: boards, cards, lists, members, and checklists.", category: "Project Management", ...composio("composio-skills/trello-automation") },
  { slug: "wrike-automation", name: "Wrike Automation", description: "Automate Wrike: tasks, folders, projects, comments, and workflows.", category: "Project Management", ...composio("composio-skills/wrike-automation") },

  // ── Communication ────────────────────────────────────────────────────
  { slug: "discord-automation", name: "Discord Automation", description: "Automate Discord: messages, channels, servers, roles, and reactions.", category: "Communication", ...composio("composio-skills/discord-automation") },
  { slug: "intercom-automation", name: "Intercom Automation", description: "Automate Intercom: conversations, contacts, companies, tickets, and articles.", category: "Communication", ...composio("composio-skills/intercom-automation") },
  { slug: "microsoft-teams-automation", name: "Microsoft Teams Automation", description: "Automate Teams: messages, channels, teams, chats, and meetings.", category: "Communication", ...composio("composio-skills/microsoft-teams-automation") },
  { slug: "slack-automation", name: "Slack Automation", description: "Automate Slack: messages, channels, search, reactions, threads, and scheduling.", category: "Communication", ...composio("composio-skills/slack-automation") },
  { slug: "telegram-automation", name: "Telegram Automation", description: "Automate Telegram: messages, chats, media, groups, and bots.", category: "Communication", ...composio("composio-skills/telegram-automation") },
  { slug: "whatsapp-automation", name: "WhatsApp Automation", description: "Automate WhatsApp: messages, media, templates, groups, and business profiles.", category: "Communication", ...composio("composio-skills/whatsapp-automation") },

  // ── Email ────────────────────────────────────────────────────────────
  { slug: "gmail-automation", name: "Gmail Automation", description: "Automate Gmail: send/reply, search, labels, drafts, and attachments.", category: "Email", ...composio("composio-skills/gmail-automation") },
  { slug: "outlook-automation", name: "Outlook Automation", description: "Automate Outlook: emails, folders, contacts, and calendar integration.", category: "Email", ...composio("composio-skills/outlook-automation") },
  { slug: "postmark-automation", name: "Postmark Automation", description: "Automate Postmark: transactional emails, templates, servers, and delivery stats.", category: "Email", ...composio("composio-skills/postmark-automation") },
  { slug: "sendgrid-automation", name: "SendGrid Automation", description: "Automate SendGrid: emails, templates, contacts, lists, and campaign stats.", category: "Email", ...composio("composio-skills/sendgrid-automation") },

  // ── Code & DevOps ────────────────────────────────────────────────────
  { slug: "bitbucket-automation", name: "Bitbucket Automation", description: "Automate Bitbucket: repos, PRs, branches, issues, and workspaces.", category: "Code & DevOps", ...composio("composio-skills/bitbucket-automation") },
  { slug: "circleci-automation", name: "CircleCI Automation", description: "Automate CircleCI: pipelines, workflows, jobs, and project configuration.", category: "Code & DevOps", ...composio("composio-skills/circleci-automation") },
  { slug: "datadog-automation", name: "Datadog Automation", description: "Automate Datadog: monitors, dashboards, metrics, incidents, and alerts.", category: "Code & DevOps", ...composio("composio-skills/datadog-automation") },
  { slug: "github-automation", name: "GitHub Automation", description: "Automate GitHub: issues, PRs, repos, branches, actions, and code search.", category: "Code & DevOps", ...composio("composio-skills/github-automation") },
  { slug: "gitlab-automation", name: "GitLab Automation", description: "Automate GitLab: issues, MRs, projects, pipelines, and branches.", category: "Code & DevOps", ...composio("composio-skills/gitlab-automation") },
  { slug: "pagerduty-automation", name: "PagerDuty Automation", description: "Automate PagerDuty: incidents, services, schedules, escalation policies, and on-call.", category: "Code & DevOps", ...composio("composio-skills/pagerduty-automation") },
  { slug: "render-automation", name: "Render Automation", description: "Automate Render: services, deploys, and project management.", category: "Code & DevOps", ...composio("composio-skills/render-automation") },
  { slug: "sentry-automation", name: "Sentry Automation", description: "Automate Sentry: issues, events, projects, releases, and alerts.", category: "Code & DevOps", ...composio("composio-skills/sentry-automation") },
  { slug: "supabase-automation", name: "Supabase Automation", description: "Automate Supabase: SQL queries, table schemas, edge functions, and storage.", category: "Code & DevOps", ...composio("composio-skills/supabase-automation") },
  { slug: "vercel-automation", name: "Vercel Automation", description: "Automate Vercel: deployments, projects, domains, environment variables, and logs.", category: "Code & DevOps", ...composio("composio-skills/vercel-automation") },

  // ── Storage & Files ──────────────────────────────────────────────────
  { slug: "box-automation", name: "Box Automation", description: "Automate Box: files, folders, search, sharing, collaborations, and sign requests.", category: "Storage & Files", ...composio("composio-skills/box-automation") },
  { slug: "dropbox-automation", name: "Dropbox Automation", description: "Automate Dropbox: files, folders, search, sharing, and batch operations.", category: "Storage & Files", ...composio("composio-skills/dropbox-automation") },
  { slug: "google-drive-automation", name: "Google Drive Automation", description: "Automate Google Drive: upload, download, search, share, and organize files.", category: "Storage & Files", ...composio("composio-skills/google-drive-automation") },
  { slug: "onedrive-automation", name: "OneDrive Automation", description: "Automate OneDrive: files, folders, search, sharing, permissions, and versioning.", category: "Storage & Files", ...composio("composio-skills/one-drive-automation") },

  // ── Spreadsheets & Databases ─────────────────────────────────────────
  { slug: "airtable-automation", name: "Airtable Automation", description: "Automate Airtable: records, tables, bases, views, and field management.", category: "Spreadsheets & Databases", ...composio("composio-skills/airtable-automation") },
  { slug: "coda-automation", name: "Coda Automation", description: "Automate Coda: docs, tables, rows, formulas, and automations.", category: "Spreadsheets & Databases", ...composio("composio-skills/coda-automation") },
  { slug: "googlesheets-automation", name: "Google Sheets Automation", description: "Automate Google Sheets: read/write cells, formatting, formulas, and batch operations.", category: "Spreadsheets & Databases", ...composio("composio-skills/googlesheets-automation") },

  // ── Calendar & Scheduling ────────────────────────────────────────────
  { slug: "cal-com-automation", name: "Cal.com Automation", description: "Automate Cal.com: event types, bookings, availability, and scheduling.", category: "Calendar & Scheduling", ...composio("composio-skills/cal-com-automation") },
  { slug: "calendly-automation", name: "Calendly Automation", description: "Automate Calendly: events, invitees, event types, scheduling links, and availability.", category: "Calendar & Scheduling", ...composio("composio-skills/calendly-automation") },
  { slug: "google-calendar-automation", name: "Google Calendar Automation", description: "Automate Google Calendar: events, attendees, free/busy, and recurring schedules.", category: "Calendar & Scheduling", ...composio("composio-skills/google-calendar-automation") },
  { slug: "outlook-calendar-automation", name: "Outlook Calendar Automation", description: "Automate Outlook Calendar: events, attendees, reminders, and recurring schedules.", category: "Calendar & Scheduling", ...composio("composio-skills/outlook-calendar-automation") },

  // ── Social Media ─────────────────────────────────────────────────────
  { slug: "instagram-automation", name: "Instagram Automation", description: "Automate Instagram: posts, stories, comments, media, and business insights.", category: "Social Media", ...composio("composio-skills/instagram-automation") },
  { slug: "linkedin-automation", name: "LinkedIn Automation", description: "Automate LinkedIn: posts, profiles, companies, images, and comments.", category: "Social Media", ...composio("composio-skills/linkedin-automation") },
  { slug: "reddit-automation", name: "Reddit Automation", description: "Automate Reddit: posts, comments, subreddits, voting, and moderation.", category: "Social Media", ...composio("composio-skills/reddit-automation") },
  { slug: "tiktok-automation", name: "TikTok Automation", description: "Automate TikTok: video uploads, queries, and creator management.", category: "Social Media", ...composio("composio-skills/tiktok-automation") },
  { slug: "twitter-automation", name: "Twitter/X Automation", description: "Automate Twitter/X: tweets, search, users, lists, and engagement.", category: "Social Media", ...composio("composio-skills/twitter-automation") },
  { slug: "youtube-automation", name: "YouTube Automation", description: "Automate YouTube: videos, channels, playlists, comments, and subscriptions.", category: "Social Media", ...composio("composio-skills/youtube-automation") },

  // ── Marketing & Email Marketing ──────────────────────────────────────
  { slug: "activecampaign-automation", name: "ActiveCampaign Automation", description: "Automate ActiveCampaign: contacts, deals, campaigns, lists, and automations.", category: "Marketing & Email Marketing", ...composio("composio-skills/activecampaign-automation") },
  { slug: "brevo-automation", name: "Brevo Automation", description: "Automate Brevo: contacts, email campaigns, transactional emails, and lists.", category: "Marketing & Email Marketing", ...composio("composio-skills/brevo-automation") },
  { slug: "convertkit-automation", name: "ConvertKit Automation", description: "Automate ConvertKit (Kit): subscribers, tags, sequences, broadcasts, and forms.", category: "Marketing & Email Marketing", ...composio("composio-skills/convertkit-automation") },
  { slug: "klaviyo-automation", name: "Klaviyo Automation", description: "Automate Klaviyo: profiles, lists, segments, campaigns, and events.", category: "Marketing & Email Marketing", ...composio("composio-skills/klaviyo-automation") },
  { slug: "mailchimp-automation", name: "Mailchimp Automation", description: "Automate Mailchimp: audiences, campaigns, templates, segments, and reports.", category: "Marketing & Email Marketing", ...composio("composio-skills/mailchimp-automation") },

  // ── Support & Helpdesk ───────────────────────────────────────────────
  { slug: "freshdesk-automation", name: "Freshdesk Automation", description: "Automate Freshdesk: tickets, contacts, agents, groups, and canned responses.", category: "Support & Helpdesk", ...composio("composio-skills/freshdesk-automation") },
  { slug: "freshservice-automation", name: "Freshservice Automation", description: "Automate Freshservice: tickets, assets, changes, problems, and service catalog.", category: "Support & Helpdesk", ...composio("composio-skills/freshservice-automation") },
  { slug: "helpscout-automation", name: "Help Scout Automation", description: "Automate Help Scout: conversations, customers, mailboxes, and tags.", category: "Support & Helpdesk", ...composio("composio-skills/helpdesk-automation") },
  { slug: "zendesk-automation", name: "Zendesk Automation", description: "Automate Zendesk: tickets, users, organizations, search, and macros.", category: "Support & Helpdesk", ...composio("composio-skills/zendesk-automation") },

  // ── E-commerce & Payments ────────────────────────────────────────────
  { slug: "shopify-automation", name: "Shopify Automation", description: "Automate Shopify: products, orders, customers, inventory, and GraphQL queries.", category: "E-commerce & Payments", ...composio("composio-skills/shopify-automation") },
  { slug: "square-automation", name: "Square Automation", description: "Automate Square: payments, customers, catalog, orders, and locations.", category: "E-commerce & Payments", ...composio("composio-skills/square-automation") },
  { slug: "stripe-automation", name: "Stripe Automation", description: "Automate Stripe: charges, customers, products, subscriptions, and refunds.", category: "E-commerce & Payments", ...composio("composio-skills/stripe-automation") },

  // ── Design & Collaboration ───────────────────────────────────────────
  { slug: "canva-automation", name: "Canva Automation", description: "Automate Canva: designs, templates, assets, folders, and brand kits.", category: "Design & Collaboration", ...composio("composio-skills/canva-automation") },
  { slug: "confluence-automation", name: "Confluence Automation", description: "Automate Confluence: pages, spaces, search, CQL, labels, and versions.", category: "Design & Collaboration", ...composio("composio-skills/confluence-automation") },
  { slug: "docusign-automation", name: "DocuSign Automation", description: "Automate DocuSign: envelopes, templates, signing, and document management.", category: "Design & Collaboration", ...composio("composio-skills/docusign-automation") },
  { slug: "figma-automation", name: "Figma Automation", description: "Automate Figma: files, components, comments, projects, and team management.", category: "Design & Collaboration", ...composio("composio-skills/figma-automation") },
  { slug: "miro-automation", name: "Miro Automation", description: "Automate Miro: boards, sticky notes, shapes, connectors, and items.", category: "Design & Collaboration", ...composio("composio-skills/miro-automation") },
  { slug: "webflow-automation", name: "Webflow Automation", description: "Automate Webflow: CMS collections, items, sites, publishing, and assets.", category: "Design & Collaboration", ...composio("composio-skills/webflow-automation") },

  // ── Analytics & Data ─────────────────────────────────────────────────
  { slug: "amplitude-automation", name: "Amplitude Automation", description: "Automate Amplitude: events, cohorts, user properties, and analytics queries.", category: "Analytics & Data", ...composio("composio-skills/amplitude-automation") },
  { slug: "google-analytics-automation", name: "Google Analytics Automation", description: "Automate Google Analytics: reports, dimensions, metrics, and property management.", category: "Analytics & Data", ...composio("composio-skills/google-analytics-automation") },
  { slug: "mixpanel-automation", name: "Mixpanel Automation", description: "Automate Mixpanel: events, funnels, cohorts, annotations, and JQL queries.", category: "Analytics & Data", ...composio("composio-skills/mixpanel-automation") },
  { slug: "posthog-automation", name: "PostHog Automation", description: "Automate PostHog: events, persons, feature flags, insights, and annotations.", category: "Analytics & Data", ...composio("composio-skills/posthog-automation") },
  { slug: "segment-automation", name: "Segment Automation", description: "Automate Segment: sources, destinations, tracking, and warehouse connections.", category: "Analytics & Data", ...composio("composio-skills/segment-automation") },

  // ── HR & People ──────────────────────────────────────────────────────
  { slug: "bamboohr-automation", name: "BambooHR Automation", description: "Automate BambooHR: employees, time off, reports, and directory management.", category: "HR & People", ...composio("composio-skills/bamboohr-automation") },

  // ── Automation Platforms ─────────────────────────────────────────────
  { slug: "make-automation", name: "Make Automation", description: "Automate Make (Integromat): scenarios, connections, and execution management.", category: "Automation Platforms", ...composio("composio-skills/make-automation") },

  // ── Zoom & Meetings ──────────────────────────────────────────────────
  { slug: "zoom-automation", name: "Zoom Automation", description: "Automate Zoom: meetings, recordings, participants, webinars, and reports.", category: "Zoom & Meetings", ...composio("composio-skills/zoom-automation") },
];
