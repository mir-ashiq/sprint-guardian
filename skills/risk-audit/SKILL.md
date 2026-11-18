---
name: Sprint risk audit
description: Playbook for auditing a Jira issue, a sprint, or a whole board for delivery risk using Sprint Guardian tools. Use when the user asks to audit, review, check, or triage sprint risk, or mentions risk signals like missing acceptance criteria, stale work, or review load.
---

# Sprint risk audit

## When to use this skill

Use this skill whenever the user asks anything about sprint or issue risk: audits, "how are we doing", "what's risky", "check this ticket", signal definitions, or remediation.

## Steps

1. **Establish scope.** If the user mentions a specific issue key (e.g. `PROJ-123`), audit that issue. If they mention a sprint or board, or ask generally, get a sprint snapshot first.
2. **Call `audit-issue`** with `issueKeyOrId` when a single issue is in scope. Read the returned findings; they are your only source of truth. Never invent findings.
3. **Call `get-sprint-snapshot`** (optionally with `boardId`) when board/sprint-level context is wanted. Use the top issues list to suggest which issue to audit next.
4. **Explain signals.** If the user asks what a signal means or disputes a finding, call `explain-risk-signal` with the exact machine name (e.g. `missing-acceptance-criteria`) and relay the detection rule and thresholds.
5. **Offer remediation.** For each finding, state the suggested action that came back from the tools. Ask before any write.
6. **Write only on request.** If the user accepts, call `draft-follow-up-task` (CREATE) with `parentIssueKey`, `summary`, `riskSignal`, and `findingsJson`; or `annotate-issue` (UPDATE) to post the report as a comment. Report the created key / comment confirmation.
7. **If data looks stale**, call `run-board-scan` to force a recompute, then re-read the snapshot.

## Output format

- Lead with the verdict line: 🟢/🟡/🔴 + level + scope (issue key or sprint name).
- Findings as `signal (severity): evidence -> suggested action` lines.
- End with exactly one recommended next step, phrased as a question when it implies a write ("Want me to draft the follow-up task?").

## Guardrails

- Read-only by default; writes only after explicit user confirmation.
- Never claim a finding the tools did not return.
- When invoked from an automation rule (no chat user), do analysis only — never invoke CREATE/UPDATE actions.
- Unknown signal names: ask for clarification or list the known signals rather than guessing.
