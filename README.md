# 🛡️ Sprint Guardian

**The AI risk radar for Jira sprints.** A Forge app for Codegeist 2026 that watches
every sprint like a tech lead: it detects risk signals before they become
incidents, explains them with evidence, and turns them into follow-up work —
through a UI, a Rovo agent, or MCP.

> Teams don't fail sprints because work is hard. They fail because risk is
> invisible until it's too late. Sprint Guardian makes it visible early.

## What it does

| Surface | Module | What the user gets |
|---|---|---|
| **Risk Radar panel** (issue view) | `jira:issuePanel` | Instant audit of the open issue: 🟢/🟡/🔴 verdict, findings with evidence, one-click "Draft follow-up" |
| **Command Center** (global page) | `jira:globalPage` | Board picker, scan-now, signal rollup, top-risk issues, risk trend |
| **Sprint Guardian agent** | `rovo:agent` + 2 `rovo:skill`s | Chat with the risk analyst; it calls the same tools and can create subtasks / post reports |
| **MCP server** | `rovo:mcp` | All 6 tools exposed for Rovo Studio custom agents and third-party MCP clients |
| **Continuous watch** | `scheduledTrigger` + `trigger` | Hourly board re-scan with KVS-persisted snapshots for trend lines |

## Risk signals (the engine)

Pure, deterministic, unit-tested (`npm test`, 20 assertions):

| Signal | Severity | Detection |
|---|---|---|
| `missing-acceptance-criteria` | high | No AC section / Given-When-Then / 3+ checklist in description (ADF-aware) |
| `unestimated-work` | medium | Story/bug with no estimate (checks 3 common customfields) |
| `stale-in-progress` | medium | In Progress, no update ≥ 3 days (configurable) |
| `overdue-sprint-item` | high | Sprint end passed, item not done |
| `review-load` | medium | Assignee has > 2 open PRs across sprint items (Bitbucket dev-status) |
| `blocking-dependency` | high | Blocked-by link to unresolved issue |
| `scope-churn` | low | Description edited > 3 times (issue changelog) |

## Judge quick path (fresh site, 60 seconds)

The Command Center detects an empty site and offers **Generate demo project**:
one click creates the `SGD` Scrum project with a 10-issue active sprint tuned
so every risk signal fires (overdue bugs without estimates, stale work, a
blocked dependency, thin descriptions). Click **Scan now** and the full risk
radar populates — no manual data entry. The same seeder is idempotent and
never touches existing projects.

## Quick start

```bash
npm install -g @forge/cli@latest
npm install            # backend + frontend deps
forge register         # first time only; then put your app id in manifest.yml
forge deploy
forge install          # your site, e.g. example.atlassian.net
```

Then:
1. Open any issue → **Risk Radar** panel → instant audit.
2. Apps menu → **Sprint Guardian** → Command Center → *Scan now*.
3. Rovo Chat → Browse Agents → **Sprint Guardian** → *"What are the biggest risks in my current sprint?"*

> **Rovo chat note:** free developer sites may not show Rovo chat. If so, run
> `forge site provision` and install with `forge install --demo-site` (comes with
> enterprise Jira/Confluence/Rovo). The panel and global page work everywhere.

## Architecture

```
src/backend/risk-engine.js     pure engine: signals, scoring, rollups (no I/O)
src/backend/jira-client.js     Jira REST via @forge/api (search/jql + legacy fallback,
                               agile sprints, changelog, subtasks, comments)
src/backend/bitbucket-client.js dev-status → linked PRs → review-load
src/backend/scan.js            orchestration + KVS snapshots (14/board trend)
src/index.js                   resolver + trigger + scheduled + 6 agent actions
src/frontend/index.jsx         UI Kit: Command Center + Risk Radar (one resource)
skills/risk-audit/SKILL.md     agent playbook: audit flow + guardrails
skills/remediation/SKILL.md    agent playbook: confirm-then-write remediation
prompts/guardian-agent-prompt.txt  agent system prompt (role/actions/format/boundaries)
```

**Design principles**
- *Pure core*: the engine is deterministic and fully unit-tested; all I/O lives at the edges.
- *Graceful degradation*: no Bitbucket link? review-load is simply absent. KVS down? scan still returns.
- *Safe agent*: read-only by default; CREATE/UPDATE tools only after explicit user confirmation (enforced in prompts + skills).
- *Judge-installable*: `forge deploy` + one install link, no external services, no keys.

## Tests

```bash
npm test    # vitest — risk engine: AC heuristics, thresholds, rollups, explain
```

## Tech

Forge (UI Kit + Custom UI resource), Rovo agent/actions/skills/MCP, KVS,
Jira REST v3 + Agile, Bitbucket dev-status, Node 24 runtime.

## License

Apache-2.0 — see [LICENSE](LICENSE).
