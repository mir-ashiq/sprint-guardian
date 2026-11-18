# Sprint Guardian — demo video script (target: 3:40, hard cap 5:00)

Recording checklist: 1080p, browser zoom ~110%. STRONGEST OPTION: record on a
brand-EMPTY free Jira site and open with the seeder — it is the ultimate proof
of judge-installability ("works on a stranger's empty site", the exact scenario
judges are in). Do a full dry run first.

| Time | Section | Screen | Narration (say this) |
|---|---|---|---|
| 0:00 | Hook: empty site → one click | Command Center on an EMPTY site, click "Generate demo project" | "Sprints don't fail because work is hard. They fail because risk is invisible until it's too late. This is Sprint Guardian — and this is a brand-new, empty Jira site. One click creates a realistic sprint tuned to trip every risk signal." |
| 0:20 | Scan | Click "Scan now", results populate | "Scan now. Seven deterministic signals — and every finding shows its evidence. This demo sprint just surfaced missing acceptance criteria, stale work, an overdue blocker — in seconds, on data that didn't exist a minute ago." |
| 0:45 | The panel | Open the reddest issue, scroll findings | "On every issue, the Risk Radar panel runs the same audit. Every finding shows its evidence: no acceptance criteria, In Progress for six days, blocked by an unresolved issue. Not vibes — the actual thresholds." |
| 1:10 | One-click fix | Click "Draft follow-up" | "One click turns findings into a ready-to-review subtask, so risk becomes assigned work instead of a retro topic." |
| 1:25 | Command Center trend | Global page, risk trend | "The Command Center keeps a persisted risk trend — snapshots stored in Forge KVS, refreshed hourly by a scheduled trigger. Risk over time, not just risk right now." |
| 1:50 | The agent | Rovo chat, ask the opening question | "Sprint Guardian is also a Rovo agent. Ask it anything about sprint risk — it runs the same engine, explains each signal, and can post the full report as a comment on the issue." |
| 2:25 | Agent writes safely | Agent asks before creating subtask | "Writes are gated: the agent asks before it creates anything, and automation-invoked runs are read-only by design." |
| 2:45 | MCP | Show manifest rovo:mcp block on screen | "Every tool is also exposed through Atlassian MCP — your own Rovo Studio agents or third-party MCP clients can call the same six tools. One engine, three surfaces: UI, agent, MCP." |
| 3:10 | How it's built | Architecture diagram from README | "A pure, deterministic risk engine — no I/O, no clock reads — with 23 unit tests. All I/O lives at the edges: Jira REST v3 with fallbacks, Bitbucket dev-status, Forge KVS." |
| 3:30 | Close | Risk Radar panel again | "Sprint Guardian: see risk early, explain it with evidence, turn it into work. Built on Forge with Rovo agents, skills, and MCP — installable and useful on any site, even an empty one." |

Rules mapping (do not skip in the final cut):
- Show the app **installed and working on a real Jira site** (rules: must be
  installable and testable by judges). The seeder opening proves this harder
  than any curated demo data could.
- Show the **rovo:agent** and **rovo:mcp** usage explicitly (bonus prize
  evidence).
- Keep it under 5 minutes; upload public to YouTube; paste link in submission.

Fallback recording option (existing site with realistic sprint): if you
already have a good test site with 8-12 mixed-state issues, the original flow
(panel-first) still works — but lead with the empty-site version if you can;
no competitor can currently match that opening.
