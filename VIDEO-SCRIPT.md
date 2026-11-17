# Sprint Guardian — demo video script (target: 3:40, hard cap 5:00)

Recording checklist: 1080p, browser zoom ~110%, clean test site with a
realistic sprint (8-12 issues, mixed states). Do a full dry run first.

| Time | Section | Screen | Narration (say this) |
|---|---|---|---|
| 0:00 | Hook | Risk Radar panel on a red issue | "Sprints don't fail because work is hard. They fail because risk is invisible until it's too late. This is Sprint Guardian — the risk radar that watches your Jira sprint like a tech lead." |
| 0:20 | The panel | Same issue, scroll through findings | "On every issue, the Risk Radar panel runs a live audit. Seven deterministic signals — and every finding shows its evidence: this ticket has no acceptance criteria, it's been In Progress for six days, and it's blocked by an unresolved issue. Not vibes — the actual thresholds." |
| 0:50 | One-click fix | Click "Draft follow-up" | "One click turns findings into a ready-to-review subtask, so risk becomes assigned work instead of a retro topic." |
| 1:05 | Command Center | Global page, scan a board | "The Command Center scans the whole board: signal rollup, top-risk issues, and a persisted risk trend — snapshots stored in Forge KVS, refreshed hourly by a scheduled trigger." |
| 1:35 | The agent | Rovo chat, ask the opening question | "Sprint Guardian is also a Rovo agent. Ask it anything about sprint risk — it runs the same engine, explains each signal, and can post the full report as a comment on the issue." |
| 2:10 | Agent writes safely | Agent asks before creating subtask | "Writes are gated: the agent asks before it creates anything, and automation-invoked runs are read-only by design." |
| 2:30 | MCP | Show manifest rovo:mcp block on screen | "Every tool is also exposed through Atlassian MCP — your own Rovo Studio agents or third-party MCP clients can call the same six tools. One engine, three surfaces: UI, agent, MCP." |
| 3:00 | How it's built | Architecture diagram from README | "A pure, deterministic risk engine — no I/O, no clock reads — with 23 unit tests. All I/O lives at the edges: Jira REST v3 with fallbacks, Bitbucket dev-status, Forge KVS." |
| 3:25 | Close | Risk Radar panel again | "Sprint Guardian: see risk early, explain it with evidence, turn it into work. Built on Forge with Rovo agents, skills, and MCP." |

Rules mapping (do not skip in the final cut):
- Show the app **installed and working on a real Jira site** (rules: must be
  installable and testable by judges).
- Show the **rovo:agent** and **rovo:mcp** usage explicitly (bonus prize
  evidence).
- Keep it under 5 minutes; upload public to YouTube; paste link in submission.
