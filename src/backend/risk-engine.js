/**
 * Sprint Guardian — risk engine.
 *
 * Pure, deterministic functions only: no Forge APIs, no network, no clock
 * reads (dates are passed in). Everything here is unit-tested in
 * tests/risk-engine.test.js and reused by the scheduled scan, the Rovo
 * agent actions, the issue panel and the command center.
 */

/** Machine-readable catalog of every risk signal the engine can emit. */
export const SIGNAL_CATALOG = {
  'missing-acceptance-criteria': {
    label: 'Missing acceptance criteria',
    severity: 'high',
    weight: 3,
    description:
      'The description has no acceptance criteria section, checklist, or ' +
      'Given/When/Then scenarios. Work without a definition of done is a ' +
      'top source of rework and scope arguments.',
    remediation:
      'Add an "Acceptance Criteria" section with testable bullets before ' +
      'this item leaves In Progress.',
  },
  'unestimated-work': {
    label: 'Unestimated work',
    severity: 'medium',
    weight: 2,
    description:
      'A story or bug has no story-point estimate, so sprint capacity and ' +
      'burndown are silently wrong.',
    remediation: 'Estimate the item, or explicitly mark it as a spike.',
  },
  'stale-in-progress': {
    label: 'Stale in progress',
    severity: 'medium',
    weight: 2,
    description:
      'The item has been In Progress with no update for longer than the ' +
      'configured stale threshold. Usually means blocked, abandoned, or ' +
      'larger than it looked.',
    remediation:
      'Ping the assignee for a status update, or split the work into ' +
      'smaller pieces.',
  },
  'overdue-sprint-item': {
    label: 'Overdue sprint item',
    severity: 'high',
    weight: 3,
    description:
      'The sprint end date has passed and this item is not Done.',
    remediation: 'Move it to the next sprint with a note, or close it as obsolete.',
  },
  'review-load': {
    label: 'Review load',
    severity: 'medium',
    weight: 2,
    description:
      'The assignee has more open pull requests than the configured limit ' +
      'across their sprint items, so reviews are queueing up.',
    remediation: 'Distribute reviews, or ask for a reviewer swap today.',
  },
  'blocking-dependency': {
    label: 'Blocking dependency',
    severity: 'high',
    weight: 3,
    description:
      'This item is blocked by a linked issue that is not resolved.',
    remediation:
      'Check the blocking issue; escalate or re-plan if it will not land soon.',
  },
  'scope-churn': {
    label: 'Scope churn',
    severity: 'low',
    weight: 1,
    description:
      'The description has been edited more than the configured churn ' +
      'limit since creation. Frequent rewrites mean the requirements are ' +
      'still moving.',
    remediation: 'Freeze the scope: confirm acceptance criteria with the reporter.',
  },
};

/** Tunable thresholds; every value is editable in the Command Center. */
export const DEFAULT_CONFIG = {
  staleDays: 3,
  reviewLoadLimit: 2,
  scopeChurnLimit: 3,
};

/**
 * Walk an Atlassian Document Format tree and collect all text, plus the
 * text that appears after a given substring match (used for AC sections).
 */
function adfText(nodes, out = []) {
  if (!Array.isArray(nodes)) return out;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'text' && typeof node.text === 'string') {
      out.push(node.text);
    }
    if (Array.isArray(node.content)) adfText(node.content, out);
  }
  return out;
}

/**
 * Decide whether a description contains acceptance criteria.
 * Heuristic, deliberately broad to avoid false alarms:
 *  - a "Given/When/Then" block anywhere, or
 *  - an "Acceptance Criteria"/"AC" heading followed by real content, or
 *  - a checklist (taskList) with 3+ items anywhere in the description.
 */
export function hasAcceptanceCriteria(descriptionAdf) {
  if (!descriptionAdf || !Array.isArray(descriptionAdf.content)) return false;
  const full = adfText(descriptionAdf.content).join(' ');
  if (!full.trim()) return false;

  if (/\bgiven\b[\s\S]{0,400}\bwhen\b[\s\S]{0,400}\bthen\b/i.test(full)) {
    return true;
  }

  const acMatch = full.match(/acceptance\s*criteri(a|on)|(?:^|\n)\s*#{0,6}\s*ACs?\s*[:\-]\s*\n?/i);
  if (acMatch) {
    const tail = full.slice((acMatch.index ?? 0) + acMatch[0].length);
    // There is an AC section; is there anything substantive after it?
    if (tail.replace(/\s+/g, ' ').trim().length >= 10) return true;
  }

  const taskItems = JSON.stringify(descriptionAdf).match(/"type":"taskItem"/g) || [];
  if (taskItems.length >= 3) return true;

  return false;
}

const STORY_LIKE_TYPES = new Set(['story', 'bug', 'user story', 'defect', 'improvement']);
const DONE_CATEGORIES = new Set(['done', 'closed']);

function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return (b - a) / 86_400_000;
}

/**
 * Audit one normalized issue. `ctx` carries everything the engine cannot
 * know on its own: the sprint dates, the "now" timestamp, config and the
 * assignee's total open-PR count across the sprint.
 *
 * @param {object} issue normalized issue (see jira-client.normalizeIssue)
 * @param {object} ctx { now, sprint, config, openPrCountByAssignee }
 * @returns {Array<{signal, severity, weight, evidence, suggestedAction}>}
 */
export function detectSignals(issue, ctx = {}) {
  const now = ctx.now || new Date().toISOString();
  const config = { ...DEFAULT_CONFIG, ...(ctx.config || {}) };
  const findings = [];
  const push = (signal, evidence) => {
    const meta = SIGNAL_CATALOG[signal];
    findings.push({
      signal,
      severity: meta.severity,
      weight: meta.weight,
      evidence,
      suggestedAction: meta.remediation,
    });
  };

  if (!hasAcceptanceCriteria(issue.description)) {
    push('missing-acceptance-criteria', 'No acceptance criteria, checklist or Given/When/Then found in the description');
  }

  if (
    STORY_LIKE_TYPES.has((issue.issuetypeName || '').toLowerCase()) &&
    (issue.estimate === null || issue.estimate === undefined || Number(issue.estimate) === 0)
  ) {
    push('unestimated-work', `${issue.issuetypeName} has no story-point estimate`);
  }

  const inProgress =
    issue.statusCategory === 'indeterminate' ||
    /in\s*progress/i.test(issue.statusName || '');
  if (inProgress && issue.updated) {
    const idle = daysBetween(issue.updated, now);
    if (idle >= config.staleDays) {
      push('stale-in-progress', `In Progress with no update for ${Math.floor(idle)} days (threshold ${config.staleDays})`);
    }
  }

  const sprint = ctx.sprint;
  if (
    sprint &&
    sprint.endDate &&
    Date.parse(sprint.endDate) < Date.parse(now) &&
    !DONE_CATEGORIES.has(issue.statusCategory || '')
  ) {
    push('overdue-sprint-item', `Sprint "${sprint.name}" ended ${sprint.endDate.slice(0, 10)} and this is not Done`);
  }

  const openPrs = ctx.openPrCountByAssignee?.[issue.assigneeId] ?? 0;
  if (openPrs > config.reviewLoadLimit) {
    push('review-load', `${openPrs} open pull requests across ${issue.assigneeName || 'the assignee'}'s sprint items (limit ${config.reviewLoadLimit})`);
  }

  const blocking = (issue.blockingLinks || []).filter((l) => !l.resolved);
  if (blocking.length > 0) {
    push(
      'blocking-dependency',
      `Blocked by ${blocking.map((l) => `${l.key} (${l.statusName})`).join(', ')}`
    );
  }

  if ((issue.changelogDescriptionChanges || 0) > config.scopeChurnLimit) {
    push('scope-churn', `Description edited ${issue.changelogDescriptionChanges} times (limit ${config.scopeChurnLimit})`);
  }

  return findings;
}

/** Weighted score for one audit. */
export function scoreFindings(findings) {
  return findings.reduce((sum, f) => sum + f.weight, 0);
}

/** 🟢/🟡/🔴 level from the number of distinct signals (matches the agent prompt). */
export function riskLevel(findingsOrCount) {
  const count = Array.isArray(findingsOrCount) ? findingsOrCount.length : findingsOrCount;
  if (count >= 5) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

export const LEVEL_META = {
  low: { emoji: '🟢', label: 'LOW RISK' },
  medium: { emoji: '🟡', label: 'MEDIUM RISK' },
  high: { emoji: '🔴', label: 'HIGH RISK' },
};

/**
 * Board-level rollup over per-issue audits.
 * @param {Array<{issue, findings, score}>} audits
 * @param {object|null} sprint active sprint metadata
 */
export function summarizeBoard(audits, sprint = null) {
  const bySignal = {};
  let totalScore = 0;
  const levelCounts = { low: 0, medium: 0, high: 0 };
  for (const a of audits) {
    totalScore += a.score;
    levelCounts[riskLevel(a.findings)] += 1;
    for (const f of a.findings) {
      bySignal[f.signal] = (bySignal[f.signal] || 0) + 1;
    }
  }
  const topIssues = [...audits]
    .sort((x, y) => y.score - x.score || x.issue.key.localeCompare(y.issue.key))
    .slice(0, 5)
    .map((a) => ({
      key: a.issue.key,
      summary: a.issue.summary,
      score: a.score,
      signals: a.findings.map((f) => f.signal),
    }));
  const avg = audits.length ? totalScore / audits.length : 0;
  const overall = avg > 2.5 ? 'high' : avg >= 1 ? 'medium' : 'low';
  return {
    sprint: sprint ? { id: sprint.id, name: sprint.name, endDate: sprint.endDate } : null,
    issueCount: audits.length,
    totalScore,
    avgScore: Math.round(avg * 10) / 10,
    bySignal,
    levelCounts,
    overall,
    topIssues,
  };
}

/** Plain-language definition + thresholds for one signal (action + UI legend). */
export function explainSignal(signal) {
  const meta = SIGNAL_CATALOG[signal];
  if (!meta) return null;
  const configNotes = {
    'missing-acceptance-criteria': 'Detected when the description has no "Acceptance Criteria" section, no 3+ item checklist, and no Given/When/Then block.',
    'unestimated-work': 'Applies to stories and bugs only; an estimate of 0 counts as unestimated.',
    'stale-in-progress': `Fires after STALE_DAYS (${DEFAULT_CONFIG.staleDays} by default) days without any update while In Progress.`,
    'overdue-sprint-item': 'Fires when the sprint end date has passed and the item is not in a done-category status.',
    'review-load': `Fires when open pull requests across the assignee\'s sprint items exceed REVIEW_LOAD_LIMIT (${DEFAULT_CONFIG.reviewLoadLimit} by default).`,
    'blocking-dependency': 'Fires for "is blocked by" issue links whose target is not done.',
    'scope-churn': `Fires when the description field was edited more than SCOPE_CHURN_LIMIT (${DEFAULT_CONFIG.scopeChurnLimit} by default) times.`,
  };
  return { signal, ...meta, detection: configNotes[signal] || '' };
}
