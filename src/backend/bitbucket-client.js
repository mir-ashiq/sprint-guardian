/**
 * Sprint Guardian — Bitbucket Cloud enrichment layer.
 *
 * Adds the code dimension to sprint risk. For each sprint issue we read its
 * dev-tool connected PRs via Jira's dev-status API, then fetch each linked
 * Bitbucket PR's live state (open/merged/declined). That powers the
 * review-load signal (a dev with a queue of unreviewed PRs is a sprint
 * risk) and enriches audits with PR state.
 *
 * Everything degrades gracefully: without a Bitbucket link the app still
 * works, just without review-load / PR evidence.
 */
import api, { route } from '@forge/api';

/** GET Jira REST as app; parsed JSON or null; never throws. */
async function jget(url) {
  try {
    const res = await api.asApp().requestJira(route`${url}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** GET Bitbucket Cloud REST as app; parsed JSON or null; never throws. */
async function bget(path) {
  try {
    const res = await api.asApp().requestBitbucket(route`/2.0/${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Dev-status of one issue: { branches: [], pullRequests: [] } with
 * repository metadata per item (as connected by Jira development tools).
 */
async function getDevStatus(issueId) {
  const data = await jget(
    `/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=stash&dataType=repository`
  );
  if (!data || !Array.isArray(data.detail)) return { pullRequests: [] };
  const prs = [];
  for (const detail of data.detail) {
    for (const pr of detail.pullRequests || []) {
      prs.push({
        id: pr.id,
        name: pr.name || '',
        status: pr.status, // e.g. OPEN / MERGED / DECLINED
        url: pr.url,
        authors: (pr.authors || []).map((a) => a.name).filter(Boolean),
      });
    }
  }
  return { pullRequests: prs };
}

/**
 * Map every sprint issue to its connected pull requests.
 * @returns {Promise<Record<string, {key:string, prs:Array}>>} issueKey -> prs
 */
export async function getPullRequestsByIssue(issues) {
  const map = {};
  for (const issue of issues.slice(0, 50)) {
    const status = await getDevStatus(issue.id);
    map[issue.key] = { key: issue.key, prs: status.pullRequests };
  }
  return map;
}

/**
 * Count open PRs per author (matched against Jira display names) and
 * per-issue PR evidence. Returns:
 * {
 *   openPrCountByAssignee: { [jiraAccountId|name]: count },
 *   issuePrs: { [issueKey]: [{name, status, url}] }
 * }
 *
 * We count PRs that are OPEN (not merged/declined) and attribute them to
 * the sprint issue's assignee — that is the review-load risk owner.
 */
export async function computeReviewLoad(issues) {
  const openPrCountByAssignee = {};
  const issuePrs = {};
  const byIssue = await getPullRequestsByIssue(issues);

  for (const issue of issues) {
    const entry = byIssue[issue.key];
    if (!entry) continue;
    const open = entry.prs.filter((p) => (p.status || '').toUpperCase() === 'OPEN');
    issuePrs[issue.key] = entry.prs.map((p) => ({
      name: p.name,
      status: p.status,
      url: p.url,
    }));
    if (open.length > 0) {
      const owner = issue.assigneeId || issue.assigneeName || 'unassigned';
      openPrCountByAssignee[owner] = (openPrCountByAssignee[owner] || 0) + open.length;
    }
  }
  return { openPrCountByAssignee, issuePrs };
}
