<p align="center">
  <img src="doc/assets/header.png" alt="Paperclip — runs your business" width="720" />
</p>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="https://paperclip.ing/docs"><strong>Docs</strong></a> &middot;
  <a href="https://github.com/arunbluez/paperclip"><strong>GitHub</strong></a> &middot;
  <a href="https://discord.gg/m4HZY7xNG3"><strong>Discord</strong></a>
</p>

<p align="center">
  <a href="https://github.com/arunbluez/paperclip/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/arunbluez/paperclip/stargazers"><img src="https://img.shields.io/github/stars/arunbluez/paperclip?style=flat" alt="Stars" /></a>
  <a href="https://discord.gg/m4HZY7xNG3"><img src="https://img.shields.io/discord/000000000?label=discord" alt="Discord" /></a>
</p>

<br/>

> **This is an opinionated fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip)** with additional features for MCP server management, a skills catalog, agent chat, and Telegram integration. Built for real-world use — these features were missing from core Paperclip and are needed to run AI companies effectively.

<br/>

<div align="center">
  <video src="https://github.com/user-attachments/assets/773bdfb2-6d1e-4e30-8c5f-3487d5b70c8f" width="600" controls></video>
</div>

<br/>

## What is Paperclip?

# Open-source orchestration for zero-human companies

**If OpenClaw is an _employee_, Paperclip is the _company_**

Paperclip is a Node.js server and React UI that orchestrates a team of AI agents to run a business. Bring your own agents, assign goals, and track your agents' work and costs from one dashboard.

It looks like a task manager — but under the hood it has org charts, budgets, governance, goal alignment, and agent coordination.

**Manage business goals, not pull requests.**

|        | Step            | Example                                                            |
| ------ | --------------- | ------------------------------------------------------------------ |
| **01** | Define the goal | _"Build the #1 AI note-taking app to $1M MRR."_                    |
| **02** | Hire the team   | CEO, CTO, engineers, designers, marketers — any bot, any provider. |
| **03** | Approve and run | Review strategy. Set budgets. Hit go. Monitor from the dashboard.  |

<br/>

<div align="center">
<table>
  <tr>
    <td align="center"><strong>Works<br/>with</strong></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="32" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="32" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="32" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="32" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="32" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="32" alt="HTTP" /><br/><sub>HTTP</sub></td>
    <td align="center"><sub>Telegram</sub></td>
  </tr>
</table>

<em>If it can receive a heartbeat, it's hired.</em>

</div>

<br/>

## What this fork adds

This fork adds features that are essential for running AI companies in production. These were built out of necessity — managing agents manually doesn't scale.

<table>
<tr>
<td align="center" width="33%">
<h3>MCP Servers</h3>
Assign MCP (Model Context Protocol) tools to agents. Manage servers, configure transports, and give agents browser access, API tools, and more — all from the dashboard.
</td>
<td align="center" width="33%">
<h3>Skills Catalog</h3>
234+ pre-configured skills from Anthropic, ComposioHQ, and the community. Assign skills to agents or create custom ones. Skills are injected at runtime.
</td>
<td align="center" width="33%">
<h3>Agent Chat</h3>
Talk to your agents directly. SSE streaming, session history, tool call visualization. A supervision tool for the board — not replacing jobs, but enabling direct interaction when needed.
</td>
</tr>
<tr>
<td align="center">
<h3>Telegram Bots</h3>
Per-agent Telegram bots for mobile chat. Plus a company dashboard bot for monitoring status, managing approvals, and viewing tasks — all from Telegram.
</td>
<td align="center">
<h3>Enhanced Approvals</h3>
Agents wake up when approvals are rejected or revision-requested. Decision notes flow back to the agent. Action approvals for any task, not just hires.
</td>
<td align="center">
<h3>Agent Configuration</h3>
Unified config sheet for MCP servers and skills per agent. Org chart shows tool and skill counts. One place to manage what each agent can do.
</td>
</tr>
</table>

<br/>

## Core Paperclip features

<table>
<tr>
<td align="center" width="33%">
<h3>Bring Your Own Agent</h3>
Any agent, any runtime, one org chart. If it can receive a heartbeat, it's hired.
</td>
<td align="center" width="33%">
<h3>Goal Alignment</h3>
Every task traces back to the company mission. Agents know <em>what</em> to do and <em>why</em>.
</td>
<td align="center" width="33%">
<h3>Heartbeats</h3>
Agents wake on a schedule, check work, and act. Delegation flows up and down the org chart.
</td>
</tr>
<tr>
<td align="center">
<h3>Cost Control</h3>
Monthly budgets per agent. When they hit the limit, they stop. No runaway costs.
</td>
<td align="center">
<h3>Multi-Company</h3>
One deployment, many companies. Complete data isolation. One control plane for your portfolio.
</td>
<td align="center">
<h3>Ticket System</h3>
Every conversation traced. Every decision explained. Full tool-call tracing and immutable audit log.
</td>
</tr>
<tr>
<td align="center">
<h3>Governance</h3>
You're the board. Approve hires, override strategy, pause or terminate any agent — at any time.
</td>
<td align="center">
<h3>Org Chart</h3>
Hierarchies, roles, reporting lines. Your agents have a boss, a title, and a job description.
</td>
<td align="center">
<h3>Mobile Ready</h3>
Monitor and manage your autonomous businesses from anywhere.
</td>
</tr>
</table>

<br/>

## Quickstart

Open source. Self-hosted. No Paperclip account required.

```bash
git clone https://github.com/arunbluez/paperclip.git
cd paperclip
pnpm install
pnpm dev
```

This starts the API server at `http://localhost:3100`. An embedded PostgreSQL database is created automatically — no setup required.

> **Requirements:** Node.js 20+, pnpm 9.15+

<br/>

## MCP Servers

MCP (Model Context Protocol) lets you give agents tools — browse the web, query APIs, access databases, and more.

1. Go to **MCP Servers** in the sidebar
2. Add a server (stdio, HTTP, or SSE transport)
3. Assign it to agents from the agent detail page or org chart

Built-in servers include:
- **Playwright Browser** — headless browser with isolated per-agent profiles
- **Playwright CDP** — real Chrome via CDP for persistent sessions
- **Playwriter** — browser extension relay

MCP configuration is automatically injected into agent heartbeats and chat sessions.

<br/>

## Skills

Skills teach agents new capabilities at runtime without retraining.

1. Open an agent's detail page
2. Click **Add Skill** to browse the catalog (234+ skills)
3. Or create **Custom Skills** with inline markdown or external URLs

Skills cover: document processing, code tools, data analysis, CRM, project management, communication, and more.

<br/>

## Telegram Integration

### Agent Bots
Give any agent a Telegram bot for mobile chat:
1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Open the agent's detail page, go to Telegram config
3. Paste the bot token and connect

Send text or photos — the agent responds with full context.

### Dashboard Bot
Monitor your entire company from Telegram:
1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Go to **Company Settings** > Telegram Dashboard
3. Connect and optionally set an authorized chat ID

Commands: `/status`, `/agents`, `/tasks`, `/approvals`, `/help`

<br/>

## FAQ

**What does a typical setup look like?**
Locally, a single Node.js process manages an embedded Postgres and local file storage. For production, point it at your own Postgres and deploy however you like. Configure projects, agents, and goals — the agents take care of the rest.

If you're a solo-entrepreneur you can use Tailscale to access Paperclip on the go. Then later you can deploy to e.g. Vercel when you need it.

**Can I run multiple companies?**
Yes. A single deployment can run an unlimited number of companies with complete data isolation.

**How is this fork different from upstream Paperclip?**
This fork adds MCP server management, a skills catalog, agent chat, Telegram integration, and enhanced approvals. These are features needed for production use that upstream doesn't have yet.

**Will this fork stay compatible with upstream?**
We periodically merge upstream changes. The new features are additive — new tables, new routes, new services — so merges are typically clean.

**Do agents run continuously?**
By default, agents run on scheduled heartbeats and event-based triggers (task assignment, @-mentions). You can also hook in continuous agents like OpenClaw. You bring your agent and Paperclip coordinates.

<br/>

## Development

```bash
pnpm dev              # Full dev (API + UI)
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

See [doc/DEVELOPING.md](doc/DEVELOPING.md) for the full development guide.

<br/>

## Roadmap

### Done in this fork
- MCP server management with agent assignment
- Skills catalog (234+ skills) and custom skills
- Agent chat with SSE streaming
- Telegram bots (per-agent + company dashboard)
- Enhanced approvals with rejection/revision wakeup
- Action approvals for any task type
- Agent config sheet with unified MCP/skills management
- Assets grid for issue attachments

### Planned
- WhatsApp integration
- Voice interaction with agents
- Better onboarding flow for new users
- More built-in MCP servers (GitHub, Linear, Slack)
- Skill marketplace / community skills
- Multi-agent chat rooms
- Better mobile experience

<br/>

## Contributing

We welcome contributions. See the [contributing guide](CONTRIBUTING.md) for details.

<!-- TODO: add CONTRIBUTING.md -->

<br/>

## Community

- [Discord](https://discord.gg/m4HZY7xNG3) — Join the community
- [GitHub Issues](https://github.com/arunbluez/paperclip/issues) — bugs and feature requests
- [Upstream Paperclip](https://github.com/paperclipai/paperclip) — the original project

<br/>

## License

MIT &copy; 2026 Paperclip

<br/>

---

<p align="center">
  <img src="doc/assets/footer.jpg" alt="" width="720" />
</p>

<p align="center">
  <sub>Open source under MIT. Built for people who want to run companies, not babysit agents.</sub>
</p>
