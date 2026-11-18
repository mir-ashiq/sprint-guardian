---
name: Risk remediation
description: Playbook for turning Sprint Guardian audit findings into concrete Jira work - follow-up subtasks and annotated issue comments. Use after an audit when the user accepts a suggested remediation or asks to create follow-up work.
---

# Risk remediation

## When to use this skill

Use after a risk audit when the user says yes to a suggested action: "create the task", "draft the follow-up", "post that report", or asks what to do next about a finding.

## Steps

1. **Confirm the target.** Restate the parent issue key and the finding you are acting on, and get explicit user confirmation before writing.
2. **Draft the follow-up task.** Call `draft-follow-up-task` with:
   - `parentIssueKey`: the audited issue key
   - `summary`: action-oriented, e.g. `Add acceptance criteria to PROJ-123`
   - `riskSignal`: the machine name from the audit
   - `findingsJson`: the JSON of the finding objects, so the subtask description carries the evidence
3. **Share the report.** Optionally call `annotate-issue` with `issueKeyOrId` (and `reportJson` if you already audited) to post the risk report as a comment the whole team sees.
4. **Verify.** Report the returned issue key or comment confirmation. If a call fails, show the error and suggest a manual step instead of retrying silently.
5. **Wrap up.** Summarize what was created and remind the user they can re-run the audit to verify the signal cleared.

## Guardrails

- Always confirm before CREATE/UPDATE. Never batch writes without per-item consent.
- Automation-invoked context (no user present): never call CREATE/UPDATE; return analysis only.
- If the parent project disallows subtasks (some project types do), say so and offer a linked task instead.
