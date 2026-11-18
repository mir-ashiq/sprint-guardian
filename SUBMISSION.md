# Devpost submission draft — Sprint Guardian (win-grade, ready to paste)
# Updated Nov 18, 2026: solo voice, demo-seeder included, judge-path first.
# The live Devpost draft 1310360 already matches most of this — apply only
# the FIELD DELTA at the bottom to the live draft.

## Title
Sprint Guardian — AI risk radar for Jira sprints

## Elevator pitch (Devpost "tagline", ≤ 200 chars; 197 chars)
Jira risk radar: audits every ticket and sprint like a tech lead — 7 deterministic risk signals with evidence, a Rovo agent that explains and remediates them, and MCP tools your own agents can call.

## Inspiration
Every team I've been on has lost a sprint the same way: not to hard work, but to invisible risk — tickets with no acceptance criteria, work stale in progress for a week, a reviewer drowning in open PRs, a blocker nobody noticed until the demo. Jira already holds every one of these signals; nothing connects them. I built Sprint Guardian to be the always-on tech lead that reads those signals, explains them with evidence, and turns them into follow-up work before standup — not at retro.

## What it does
- **Risk Radar panel** on every Jira issue: instant 🟢/🟡/🔴 audit with per-signal evidence and one-click "Draft follow-up" subtask.
- **Command Center** global page: board picker, scan-now, signal rollup, top-risk issues, and a persisted risk trend (KVS snapshots).
- **Sprint Guardian Rovo agent**: chat with the risk analyst — it runs snapshots, audits issues, explains signals, drafts follow-up tasks, and posts reports as comments. Two rovo:skill playbooks (audit + remediation) keep it disciplined.
- **MCP server** (rovo:mcp): all 6 tools exposed to Rovo Studio custom agents and third-party MCP clients.
- **Continuous watch**: a scheduled trigger rescans boards hourly; an issue-created trigger hooks new work into the flow.
- **One-click demo project**: on a brand-new empty site, the Command Center offers "Generate demo project" — it seeds a 10-issue sprint deliberately tuned so every one of the 7 risk signals fires. A judge (or anyone) goes from install to a full risk radar in under a minute.

The engine detects 7 deterministic signals — missing acceptance criteria, unestimated work, stale-in-progress, overdue sprint items, review load, blocking dependencies, scope churn — each with severity, evidence, and a threshold you can reason about.

## How I built it
Forge (UI Kit global page + issue panel, resolver, triggers, scheduled jobs), a Rovo agent with 6 actions and 2 skills, an MCP server, Jira REST v3 (search/jql with legacy fallback, agile sprints, changelog churn, subtasks, ADF comments), Bitbucket dev-status for review load, and KVS for snapshot trends on the Node 24 runtime. The demo seeder uses the project-creation and sprint APIs behind write scopes that exist only for that path. The core is a pure, deterministic risk engine — no I/O, no clock reads — with 23 unit tests covering every signal, threshold and rollup.

## Challenges I ran into
Jira's search API is mid-migration (search → search/jql), so I implemented both with transparent fallback. Rovo chat isn't available on free developer sites; `forge site provision` + `--demo-site` install solves it (documented in the README). The hardest part was agent write-safety: the agent is read-only by default, and CREATE/UPDATE tools are gated behind explicit user confirmation in the prompt and both skill playbooks. Seeding demo data safely on a judge's site also took care: the seeder is idempotent, touches nothing that already exists, and labels everything it creates.

## Accomplishments I'm proud of
Every surface — panel, global page, agent, MCP — calls the same tested engine. Risk explanations show evidence ("In Progress, no update for 6 days, threshold 3"), not vibes. And the app is fully judge-installable: `forge deploy` + one install link, zero external services, zero keys, and now zero chance of an empty first screen.

## What I learned
Rovo's action-verb constraints (GET-only for automation-invoked agents) and the skills system reshaped the architecture in good ways — the safety model I ended up with is better than what I first designed. Building the demo seeder last taught me that "works on my data" and "works on a stranger's empty site" are different products, and the second one is what a hackathon actually judges.

## What's next for Sprint Guardian
A Slack/Teams digest of the nightly scan, per-team threshold tuning in the Command Center, and Teamwork Graph ingestion so risk signals can span tools.

## Built with (tags)
forge, atlassian, jira, rovo, mcp, ai-agents, react, nodejs, kvs, bitbucket, developer-tools, risk-management

## Try it out link
https://github.com/mir-ashiq/sprint-guardian

## Testing instructions (Step 3 field)
1) Click the installation link and approve the app on your Atlassian site (works on free sites). 2) NEW SITE? Open Apps → Sprint Guardian → "Generate demo project" — it creates a 10-issue sprint tuned to trip every risk signal, then click "Scan now" for the full radar. EXISTING SITE? Pick a board and click "Scan now" directly. 3) Open any Jira issue — the "Risk Radar" panel shows the instant audit: findings, evidence, one-click "Draft follow-up". 4) Rovo Chat → Browse agents → Sprint Guardian → "What are the biggest risks in my current sprint?" Note: if Rovo chat is not visible on a free site, the issue panel and global page still work fully. No credentials needed; the app is read-only by default and creates nothing without explicit confirmation. The demo seeder only creates its own labeled project and never modifies existing data.

## Technology requirement (Step 3 field)
Sprint Guardian is a Forge app: manifest.yml declares jira:globalPage, jira:issuePanel, a rovo:agent with 6 actions, 2 rovo:skill playbooks, a rovo:mcp server exposing 6 tools, plus trigger and scheduledTrigger modules. It integrates deeply with Jira — REST v3 search/jql (with legacy fallback), agile sprint boards, issue changelog, subtasks, ADF comments — and with Bitbucket dev-status for linked-PR review load. Every surface (issue panel, global page, Rovo agent, MCP tools) calls the same deterministic risk engine, which is pure and unit-tested (23 tests).

## Category + bonus
- Category: Apps for Software Teams
- Why this track: Sprint Guardian is built for the people who live in Jira: developers, tech leads and scrum masters. It embeds directly into the issue view and the sprint workflow where software teams already work, and its signals — missing acceptance criteria, stale work-in-progress, reviewer load, blocking dependencies — are the risks that specifically sink software delivery.
- Bonus prize: Best Agents — Rovo/Assignable agents

## Forge experience / AI tools (Step 3 fields)
- Forge experience: The manifest-driven model is excellent: one YAML file describes the panels, pages, agent, skills, MCP tools and triggers, and forge deploy handles the rest. UI Kit with a resolver keeps the frontend simple, and KVS made persisted risk trends easy. Friction points: Jira's search API is mid-migration (search → search/jql) so I implemented both with fallback; Rovo chat is not available on free developer sites (solved with forge site provision + --demo-site install); and agent write-safety took careful prompt and skill design so CREATE/UPDATE tools stay gated behind explicit user confirmation.
- AI tools used: An AI coding agent (GLM via z.ai) for scaffolding, implementation, unit tests and documentation; Atlassian developer documentation and the Forge CLI for API verification and deployment planning.

---

## FIELD DELTA vs the live Devpost draft (1310360) — apply ONLY these changes
The live draft is already correct for: title, tagline, story sections 1-2, tags, repo link, submitter type (Individual), country (India), start date (Nov 16, 2026), New project, category, bonus (Best Agents), Forge experience, AI tools, survey answers, eligibility checkboxes.
1. "What it does": append the last bullet — "One-click demo project: on a brand-new empty site, the Command Center offers 'Generate demo project' — it seeds a 10-issue sprint deliberately tuned so every one of the 7 risk signals fires. A judge (or anyone) goes from install to a full risk radar in under a minute."
2. "How I built it": append — "The demo seeder uses the project-creation and sprint APIs behind write scopes that exist only for that path."
3. "Challenges I ran into": append — "Seeding demo data safely on a judge's site also took care: the seeder is idempotent, touches nothing that already exists, and labels everything it creates."
4. "Accomplishments I'm proud of": change the last sentence to — "And the app is fully judge-installable: forge deploy + one install link, zero external services, zero keys, and now zero chance of an empty first screen."
5. "What I learned": append — "Building the demo seeder last taught me that 'works on my data' and 'works on a stranger's empty site' are different products, and the second one is what a hackathon actually judges."
6. Testing instructions: replace with the version above (adds the Generate-demo-project path).
