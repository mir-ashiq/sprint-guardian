/**
 * Sprint Guardian — Forge entry point.
 * All backend functions from manifest.yml live here.
 */
import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { getAllBoards } from './backend/jira-client';
import { scanBoard, getTrend, getLatest, auditOne } from './backend/scan';
import {
  SIGNAL_CATALOG,
  explainSignal,
  riskLevel,
  LEVEL_META,
} from './backend/risk-engine';
import { createSubtask, postComment, textToAdf } from './backend/jira-client';

// ---------------------------------------------------------------------------
// Resolver (frontend bridge)
// ---------------------------------------------------------------------------
const resolver = new Resolver();

resolver.define('getBoards', async () => {
  const boards = await getAllBoards();
  return { boards };
});

resolver.define('getBoardState', async ({ payload }) => {
  const boardId = String(payload.boardId);
  const [latest, trend] = await Promise.all([getLatest(boardId), getTrend(boardId)]);
  return { latest, trend };
});

resolver.define('scanBoard', async ({ payload }) => {
  const result = await scanBoard(String(payload.boardId));
  return {
    summary: result.summary,
    audits: result.audits,
    scannedAt: result.scannedAt,
  };
});

resolver.define('auditIssue', async ({ payload }) => {
  return auditOne(String(payload.issueKeyOrId));
});

resolver.define('getSignalCatalog', async () => {
  return {
    catalog: Object.fromEntries(
      Object.entries(SIGNAL_CATALOG).map(([k, v]) => [k, { label: v.label, severity: v.severity, weight: v.weight, description: v.description, remediation: v.remediation }])
    ),
  };
});

// Panel button: same logic as the agent's draft-follow-up-task action.
resolver.define('draftFollowUp', async ({ payload }) => {
  const result = await actDraftFollowUpTask(payload);
  return result;
});

export const handler = resolver.getDefinitions();

// ---------------------------------------------------------------------------
// Trigger: issue created -> instant first audit in the panel's KVS cache
// ---------------------------------------------------------------------------
export async function onIssueCreated(event) {
  try {
    const issue = event?.issue ?? event?.data?.issue;
    if (!issue || !issue.id) return;
    // Warm the panel: store a lightweight marker; the panel re-audits on open.
    // (Keeps the trigger cheap; deep audit happens on demand.)
    console.log(`Sprint Guardian saw new issue ${issue.key ?? issue.id}`);
  } catch (e) {
    console.error('onIssueCreated failed', String(e));
  }
}

// ---------------------------------------------------------------------------
// Scheduled trigger: scan every board that has a stored snapshot (opt-in
// through the Command Center's first visit), bounded per run.
// ---------------------------------------------------------------------------
export async function boardScan() {
  try {
    const boards = await getAllBoards();
    // Scan at most 3 boards per invocation to stay well within limits.
    for (const board of boards.slice(0, 3)) {
      await scanBoard(String(board.id));
    }
  } catch (e) {
    console.error('boardScan failed', String(e));
  }
}

// ---------------------------------------------------------------------------
// Rovo agent actions (also exposed via rovo:mcp)
// ---------------------------------------------------------------------------
function boardIdFromContextOrInput(payload) {
  return (
    payload?.boardId ||
    payload?.context?.board?.id ||
    null
  );
}

export async function actGetSprintSnapshot(payload) {
  const boardId = boardIdFromContextOrInput(payload);
  if (!boardId) {
    return 'No board specified. Ask the user which board, or open the app on a board first.';
  }
  const { summary, scannedAt } = await scanBoard(String(boardId));
  const meta = LEVEL_META[summary.overall] || LEVEL_META.low;
  const lines = [
    `${meta.emoji} ${meta.label} — sprint "${summary.sprint?.name || 'unknown'}"`,
    `Issues: ${summary.issueCount} | avg risk: ${summary.avgScore} | overall: ${summary.overall}`,
    `Top risks: ${
      Object.entries(summary.bySignal)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s, c]) => `${s} x${c}`)
        .join(', ') || 'none'
    }`,
    `Highest-risk issues: ${summary.topIssues.map((t) => `${t.key} (${t.score})`).join(', ') || 'none'}`,
    `Scanned at ${scannedAt}`,
  ];
  return lines.join('\n');
}

export async function actAuditIssue(payload) {
  const keyOrId = payload?.issueKeyOrId || payload?.context?.jira?.issueKey;
  if (!keyOrId) return 'No issue specified for the audit.';
  const report = await auditOne(String(keyOrId));
  if (report.error) return report.error;
  const meta = LEVEL_META[report.level] || LEVEL_META.low;
  const lines = [
    `${meta.emoji} ${meta.label} — ${report.issue.key}: ${report.issue.summary}`,
    ...report.findings.map(
      (f) => `- ${f.signal} (${f.severity}): ${f.evidence} -> ${f.suggestedAction}`
    ),
    `Score: ${report.score}`,
  ];
  return lines.join('\n');
}

export async function actExplainRiskSignal(payload) {
  const info = explainSignal(String(payload?.signal || ''));
  if (!info) return `Unknown signal. Known: ${Object.keys(SIGNAL_CATALOG).join(', ')}`;
  return `${info.signal} (${info.severity}, weight ${info.weight})\n${info.description}\nDetection: ${info.detection}\nRemediation: ${info.remediation}`;
}

export async function actRunBoardScan(payload) {
  const boardId = boardIdFromContextOrInput(payload);
  if (!boardId) return 'No board specified.';
  const { summary, scannedAt } = await scanBoard(String(boardId));
  return `Scan complete at ${scannedAt}. ${summary.issueCount} issues, avg risk ${summary.avgScore}, overall ${summary.overall}. Top signal: ${
    Object.entries(summary.bySignal).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
  }.`;
}

export async function actDraftFollowUpTask(payload) {
  const parentKey = payload?.parentIssueKey || payload?.context?.jira?.issueKey;
  if (!parentKey) return 'No parent issue specified.';
  const findings = [];
  try {
    if (payload?.findingsJson) findings.push(...JSON.parse(payload.findingsJson));
  } catch {
    // tolerate malformed JSON from the LLM
  }
  const description = [
    `Created by Sprint Guardian for risk signal: ${payload?.riskSignal || 'general'}`,
    '',
    ...(findings.length
      ? findings.map((f) => `- [${f.severity || '?'}] ${f.signal || f}`)
      : ['(no structured findings provided)']),
    '',
    'Review and adjust before starting work.',
  ];
  const result = await createSubtask(parentKey, payload?.summary || 'Follow-up', description);
  if (result.error) return `Could not create subtask: ${result.error}`;
  return `Created follow-up subtask ${result.key} under ${parentKey}.`;
}

export async function actAnnotateIssue(payload) {
  const keyOrId = payload?.issueKeyOrId || payload?.context?.jira?.issueKey;
  if (!keyOrId) return 'No issue specified.';
  let report;
  try {
    report = payload?.reportJson ? JSON.parse(payload.reportJson) : null;
  } catch {
    report = null;
  }
  if (!report) report = await auditOne(String(keyOrId));
  if (report.error) return report.error;

  const meta = LEVEL_META[report.level] || LEVEL_META.low;
  const bulletLines = report.findings.map((f) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: `${f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '🟢'} ${f.signal} — ${f.evidence} → ${f.suggestedAction}` }],
  }));
  const adf = {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: `${meta.emoji} Sprint Guardian audit — ${meta.label} (score ${report.score})` }] },
      ...bulletLines,
      { type: 'paragraph', content: [{ type: 'text', text: 'Ask the Sprint Guardian agent to draft a follow-up task for any finding.' }] },
    ],
  };
  const result = await postComment(String(keyOrId), adf);
  if (result.error) return `Could not post comment: ${result.error}`;
  return `Risk report posted as a comment on ${report.issue?.key || keyOrId}.`;
}
