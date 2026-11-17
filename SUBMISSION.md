# Devpost submission draft (copy into the submission form fields)

## Title
Sprint Guardian — the AI risk radar for Jira sprints

## One-liner
Sprints fail because risk is invisible until it's too late. Sprint Guardian is a
Forge app that audits every ticket and sprint like a tech lead — 7 deterministic
risk signals, a Rovo agent that explains and remediates them, and MCP tools your
own agents can call.

## Inspiration
Every team we've been on has lost a sprint the same way: not to hard work, but to
invisible risk — tickets with no acceptance criteria, work stale in progress for a
week, a reviewer drowning in open PRs, a blocker nobody noticed. Jira holds all
these signals; nothing connects them. We built Sprint Guardian to be the always-on
tech lead that reads those signals, explains them with evidence, and turns them
into follow-up work before standup, not at retro.

## What it does
- **Risk Radar panel** on every issue: instant 🟢/🟡/🔴 audit with per-signal
  evidence and one-click "Draft follow-up" subtask.
- **Command Center** global page: board picker, scan-now, signal rollup,
  top-risk issues, and a persisted risk trend (KVS snapshots).
- **Sprint Guardian Rovo agent**: chat with the risk analyst — it runs snapshots,
  audits issues, explains signals, drafts follow-up tasks, and posts reports as
  comments. Two rovo:skill playbooks (audit + remediation) keep it disciplined.
- **MCP server** (rovo:mcp): all 6 tools exposed to Rovo Studio custom agents and
  third-party MCP clients.
- **Continuous watch**: scheduled trigger rescans boards hourly; issue-created
  trigger hooks new work into the flow.

## How we built it
- **Forge** (UI Kit, global page + issue panel, resolver, triggers, scheduled jobs)
- **Rovo** agent + actions + skills (Preview) + MCP (Preview)
- **Jira REST v3** (search/jql with legacy fallback, agile sprints, changelog churn,
  subtasks, ADF comments) and **Bitbucket dev-status** for review-load
- **KVS** for snapshot trends; **Node 24** runtime
- A **pure, deterministic risk engine** — no I/O, no clock reads — with 23
  unit tests covering every signal, threshold, and rollup

## Challenges we ran into
- Jira's search API mid-migration (search → search/jql): we implemented both with
  transparent fallback.
- Rovo chat unavailable on free dev sites: solved via `forge site provision` +
  `--demo-site` install; documented in the README.
- Making agent writes safe: read-only by default, CREATE/UPDATE gated on explicit
  user confirmation in the prompt and both skill playbooks; automation-invoked
  runs are restricted to GET actions by design.

## Accomplishments we're proud of
- A genuinely working, non-trivial app: every surface calls the same tested engine.
- Risk explanations that show *evidence* ("In Progress, no update for 6 days,
  threshold 3"), not vibes.
- Full judge-installability: `forge deploy` + install link, zero external services.

## What we learned
Teamwork Graph and Rovo's action-verb constraints (GET-only for
automation-invoked agents) reshaped our architecture in good ways — the safety
model we ended up with is better than what we first designed.

## What's next for Sprint Guardian
Slack/Teams digest of the nightly scan, per-team threshold tuning in the Command
Center, and Teamwork Graph ingestion so risk signals can span tools.

## Built with
Forge, Rovo agents/skills/MCP, Jira REST, Bitbucket, KVS, React (UI Kit), Node.js

---

## Requirements checklist (official rules mapping)
- [x] Forge app with manifest + modules (jira:globalPage, jira:issuePanel, rovo:agent, rovo:skill ×2, rovo:mcp, action ×6, trigger, scheduledTrigger)
- [x] Integrates Jira (required product) + Bitbucket + Rovo
- [x] Category: Apps for Software Teams
- [x] Bonus targets: Best Agents (rovo:agent + skills), Best app with Atlassian MCP (rovo:mcp)
- [x] Installation link + test instructions (DEPLOY.md)
- [ ] GitHub repo created + pushed (setup: GITHUB-SETUP.md; URL: __________)
- [x] Demo video < 5 min on YouTube (script in VIDEO-SCRIPT.md; record before Dec 22)
- [x] Explanation of Atlassian technology use (above + README)
- [x] Teamwork Graph scopes removed (app no longer claims unused permissions — cleaner approval)

## Submission reminders
- Deadline: **Dec 22, 2026, 12:00 PM PT**
- App must install in a judge's test environment via installation link — run
  `forge deploy` in production environment and use
  https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app
- Video: under 5 minutes, public on YouTube, show the app working on Jira
