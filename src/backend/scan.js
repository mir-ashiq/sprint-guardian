/**
 * Sprint Guardian — board scan orchestrator.
 *
 * One pass: fetch sprint issues -> enrich (PRs, changelog churn) ->
 * run the pure risk engine -> persist snapshots to KVS for trend charts.
 * Used by the scheduled trigger, the run-board-scan action, and the
 * Command Center's "Scan now" button.
 */
import kvs from '@forge/kvs';
import {
  detectSignals,
  scoreFindings,
  riskLevel,
  summarizeBoard,
} from './risk-engine';
import {
  getActiveSprint,
  getSprintIssues,
  enrichChangelogCount,
  getIssue,
  getActiveSprintForIssue,
} from './jira-client';
import { computeReviewLoad } from './bitbucket-client';

export async function scanBoard(boardId, { now = new Date().toISOString() } = {}) {
  const sprint = await getActiveSprint(boardId);
  const issues = await getSprintIssues(boardId);

  // Enrich with PR evidence (Bitbucket) — review-load needs it.
  const { openPrCountByAssignee, issuePrs } = await computeReviewLoad(issues);

  // Audit every issue with the pure engine.
  const audits = [];
  for (const issue of issues) {
    const ctx = { now, sprint, config: undefined, openPrCountByAssignee };
    const findings = detectSignals(issue, ctx);
    audits.push({
      issue: {
        key: issue.key,
        summary: issue.summary,
        statusName: issue.statusName,
        statusCategory: issue.statusCategory,
        issuetypeName: issue.issuetypeName,
        assigneeName: issue.assigneeName,
        estimate: issue.estimate,
        updated: issue.updated,
        prs: issuePrs[issue.key] || [],
      },
      findings,
      score: scoreFindings(findings),
      level: riskLevel(findings),
    });
  }

  const summary = summarizeBoard(audits, sprint);
  await persistSnapshot(boardId, summary, now);
  return { boardId, scannedAt: now, summary, audits };
}

/** Persist a snapshot; keep the last 14 per board for the trend chart. */
async function persistSnapshot(boardId, summary, now) {
  try {
    const key = `board:${boardId}:snapshots`;
    const existing = (await kvs.get(key)) || [];
    existing.push({ at: now, avgScore: summary.avgScore, overall: summary.overall, totalScore: summary.totalScore, issueCount: summary.issueCount });
    await kvs.set(key, existing.slice(-14));
    await kvs.set(`board:${boardId}:latest`, { at: now, summary });
  } catch (e) {
    // Persistence failure must never fail a scan.
    console.error('kvs persist failed', String(e));
  }
}

/** Trend history for the Command Center chart. */
export async function getTrend(boardId) {
  try {
    return (await kvs.get(`board:${boardId}:snapshots`)) || [];
  } catch {
    return [];
  }
}

/** Latest stored summary (null before the first scan). */
export async function getLatest(boardId) {
  try {
    return (await kvs.get(`board:${boardId}:latest`)) || null;
  } catch {
    return null;
  }
}

/**
 * Audit a single issue on demand (panel + audit-issue action). Includes
 * the heavier changelog enrichment that the full-board scan skips.
 */
export async function auditOne(issueKeyOrId, { now = new Date().toISOString() } = {}) {
  const issue = await getIssue(issueKeyOrId);
  if (!issue) return { error: `Issue ${issueKeyOrId} not found or not visible to the app.` };
  const enriched = await enrichChangelogCount(issue);
  const sprint = await getActiveSprintForIssue(issue);
  const findings = detectSignals(enriched, { now, sprint });
  return {
    issue: {
      key: enriched.key,
      summary: enriched.summary,
      statusName: enriched.statusName,
      issuetypeName: enriched.issuetypeName,
      assigneeName: enriched.assigneeName,
      estimate: enriched.estimate,
      updated: enriched.updated,
    },
    findings,
    score: scoreFindings(findings),
    level: riskLevel(findings),
  };
}
