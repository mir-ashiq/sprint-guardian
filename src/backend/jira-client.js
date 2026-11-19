/**
 * Sprint Guardian — Jira REST access layer (all calls via @forge/api).
 *
 * Every fetch here is defensive: missing fields become null, transient API
 * failures become empty results, and nothing throws into the risk engine.
 * The engine stays pure; resilience lives at the edges.
 *
 * Search strategy: Jira Cloud is mid-migration from /rest/api/3/search to
 * /rest/api/3/search/jql (nextPageToken pagination). We try the new one
 * first and transparently fall back to the old one.
 */
import api, { route, routeFromAbsolute } from '@forge/api';

/**
 * GET JSON or null — never throws.
 * URLs here are dynamic strings (path + query), so they cannot go through
 * route`` — interpolated parameters containing "/" or "?" are rejected as
 * path manipulation. routeFromAbsolute parses the URL and trusts its
 * pathname+search instead.
 */
async function jget(url) {
  try {
    const target = routeFromAbsolute(new URL(url, 'https://atlassian.net').href);
    const res = await api.asApp().requestJira(target);
    if (!res.ok) {
      console.warn(`SG jget ${String(url).slice(0, 60)} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`SG jget ${String(url).slice(0, 60)} threw: ${String(e).slice(0, 200)}`);
    return null;
  }
}

/** POST JSON, returns the Response object (caller checks res.ok + parsed body). */
async function jpost(url, payload) {
  return api.asApp().requestJira(route`${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Run a JQL query and return ALL matching issues (both search endpoints,
 * full pagination, hard cap for safety).
 */
export async function searchAllIssues(jql, fields, cap = 200) {
  const fieldList = fields.join(',');

  // --- New enhanced search endpoint ---
  try {
    const issues = [];
    let nextPageToken = undefined;
    while (issues.length < cap) {
      const qs = new URLSearchParams({ jql, fields: fieldList, maxResults: '100' });
      if (nextPageToken) qs.set('nextPageToken', nextPageToken);
      const data = await jget(`/rest/api/3/search/jql?${qs.toString()}`);
      if (!data || !Array.isArray(data.issues)) break;
      issues.push(...data.issues);
      if (!data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }
    if (issues.length > 0 || (await newSearchWorks())) return issues.slice(0, cap);
  } catch {
    // fall through to legacy endpoint
  }

  // --- Legacy search endpoint fallback ---
  const issues = [];
  let startAt = 0;
  while (issues.length < cap) {
    const qs = new URLSearchParams({ jql, fields: fieldList, maxResults: '100', startAt: String(startAt) });
    const data = await jget(`/rest/api/3/search?${qs.toString()}`);
    if (!data || !Array.isArray(data.issues)) break;
    issues.push(...data.issues);
    if (startAt + (data.issues?.length || 0) >= (data.total ?? 0)) break;
    startAt += data.issues.length;
  }
  return issues.slice(0, cap);
}

const newSearchWorksCache = { value: undefined };
async function newSearchWorks() {
  if (newSearchWorksCache.value === undefined) {
    const data = await jget(`/rest/api/3/search/jql?jql=${encodeURIComponent('order by created desc')}&maxResults=1`);
    newSearchWorksCache.value = Boolean(data && Array.isArray(data.issues));
  }
  return newSearchWorksCache.value;
}

/**
 * Normalize a Jira issue (from any search endpoint or /issue/{id}) into the
 * flat shape the risk engine expects.
 */
export function normalizeIssue(raw, extra = {}) {
  const fields = raw.fields || {};
  const links = Array.isArray(fields.issuelinks) ? fields.issuelinks : [];
  // A "Blocks" link has two directions: if this issue holds the OUTWARD end
  // (link type "blocks", target in outwardIssue), then this issue BLOCKS the
  // other one. If this issue holds the INWARD end (link type "is blocked by",
  // blocker in inwardIssue), then this issue IS BLOCKED. Collect both so the
  // blocking-dependency signal fires on real boards either way.
  const blockingLinks = links
    .map((l) => {
      const name = String(l.type?.name || '').toLowerCase();
      const isInward = String(l.type?.inward || '').toLowerCase().includes('blocked');
      const isOutward = String(l.type?.outward || '').toLowerCase().includes('blocks');
      if (name === 'blocks' && l.inwardIssue) {
        // We are the blocker's target: this issue is blocked BY l.inwardIssue? No —
        // on a "Blocks"-type link, inwardIssue is the issue that THIS issue blocks.
        // Symmetric capture keeps us safe against admin-customized names:
        return { key: l.inwardIssue.key, statusName: l.inwardIssue.fields?.status?.name || 'unknown', resolved: Boolean(l.inwardIssue.fields?.resolutiondate), via: 'inward' };
      }
      if ((name === 'blocks' || isOutward) && l.outwardIssue) {
        // We said "blocks X" — the risk direction that matters for THIS issue is
        // when someone else blocks us, captured below via inward; but admins
        // rename directions, so capture outward targets flagged as blocking too.
        return { key: l.outwardIssue.key, statusName: l.outwardIssue.fields?.status?.name || 'unknown', resolved: Boolean(l.outwardIssue.fields?.resolutiondate), via: 'outward' };
      }
      return null;
    })
    .filter(Boolean)
    // The engine only cares about blockers that are NOT resolved; "via" is
    // kept for evidence/debugging.
    .map(({ via, ...rest }) => rest);

  const statusCategoryKey = fields.status?.statusCategory?.key; // new, indeterminate, done
  const statusCategory =
    statusCategoryKey === 'done'
      ? 'done'
      : statusCategoryKey === 'indeterminate'
        ? 'indeterminate'
        : 'todo';

  return {
    id: String(raw.id ?? ''),
    key: raw.key || '',
    summary: fields.summary || '',
    description: fields.description || null, // ADF
    statusName: fields.status?.name || '',
    statusCategory,
    issuetypeName: fields.issuetype?.name || '',
    assigneeId: fields.assignee?.accountId || null,
    assigneeName: fields.assignee?.displayName || null,
    estimate:
      fields.customfield_10016 ?? fields.customfield_10008 ?? fields.customfield_10026 ?? null,
    updated: fields.updated || null,
    created: fields.created || null,
    sprintId: fields.sprint?.id ?? null,
    sprintName: fields.sprint?.name ?? null,
    blockingLinks,
    changelogDescriptionChanges: 0, // filled in by enrichChangelogCount
    ...extra,
  };
}

/** All boards visible to the app (for the Command Center picker). */
export async function getAllBoards() {
  const boards = [];
  let startAt = 0;
  while (true) {
    const data = await jget(`/rest/agile/1.0/board?maxResults=50&startAt=${startAt}`);
    if (!data || !Array.isArray(data.values)) break;
    boards.push(...data.values);
    if (data.isLast || data.values.length === 0) break;
    startAt += data.values.length;
  }
  return boards.map((b) => ({ id: b.id, name: b.name, type: b.type }));
}

/**
 * Find the active sprint that contains a given issue (for single-issue
 * audits). Uses searchAllIssues so both search endpoints (new + legacy)
 * serve it — no silent nulls while Jira migrates its search API.
 */
export async function getActiveSprintForIssue(issue) {
  const key = issue.key || issue.id;
  const jql = `issue = ${key} AND sprint in openSprints()`;
  const raw = await searchAllIssues(jql, ['sprint']);
  const sprint = raw?.[0]?.fields?.sprint || null;
  if (!sprint) return null;
  return {
    id: String(sprint.id),
    name: sprint.name,
    startDate: sprint.startDate || null,
    endDate: sprint.endDate || null,
    state: sprint.state,
  };
}

/** The sprint currently active on a board (null between sprints). */
export async function getActiveSprint(boardId) {
  const data = await jget(`/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=1`);
  const sprint = data?.values?.[0] || null;
  if (!sprint) return null;
  return {
    id: String(sprint.id),
    name: sprint.name,
    startDate: sprint.startDate || null,
    endDate: sprint.endDate || null,
    state: sprint.state,
  };
}

/** All issues of the sprint currently active on a board. */
export async function getSprintIssues(boardId) {
  // Query by sprint id, not `board = <id>`: the board JQL field matches no
  // issues on current Jira Cloud versions for classic boards, which silently
  // emptied every board scan. The sprint id comes from the (working) agile
  // board endpoint, so this is also exact for boards sharing a sprint.
  const sprint = await getActiveSprint(boardId);
  if (!sprint) return [];
  const jql = `sprint = ${sprint.id}`;
  const fields = [
    'summary', 'description', 'status', 'issuetype', 'assignee',
    'updated', 'created', 'issuelinks', 'sprint',
    'customfield_10016', 'customfield_10008', 'customfield_10026',
  ];
  const raw = await searchAllIssues(jql, fields);
  return raw.map((r) => normalizeIssue(r));
}

/** One issue by key or id, normalized. */
export async function getIssue(issueKeyOrId) {
  const data = await jget(
    `/rest/api/3/issue/${encodeURIComponent(issueKeyOrId)}?fields=summary,description,status,issuetype,assignee,updated,created,issuelinks,sprint,customfield_10016,customfield_10008,customfield_10026`
  );
  if (!data) return null;
  return normalizeIssue(data);
}

/**
 * Count how many times the description field changed, from the issue
 * changelog (paginated; cap keeps this bounded for very long-lived items).
 */
export async function enrichChangelogCount(issue, capPages = 3) {
  const key = issue.key || issue.id;
  let changes = 0;
  let startAt = 0;
  for (let page = 0; page < capPages; page++) {
    const data = await jget(`/rest/api/3/issue/${encodeURIComponent(key)}/changelog?maxResults=100&startAt=${startAt}`);
    if (!data || !Array.isArray(data.values)) break;
    for (const entry of data.values) {
      for (const item of entry.items || []) {
        if (item.field === 'description') changes += 1;
      }
    }
    if (data.isLast || startAt + data.values.length >= (data.total ?? 0)) break;
    startAt += data.values.length;
  }
  return { ...issue, changelogDescriptionChanges: changes };
}

/** Render an ADF paragraph list from plain text lines. */
export function textToAdf(lines) {
  return {
    type: 'doc',
    version: 1,
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

/** Create a follow-up subtask under a parent issue; returns {key} or {error}. */
export async function createSubtask(parentKey, summary, descriptionLines) {
  const payload = {
    fields: {
      parent: { key: parentKey },
      project: { key: parentKey.split('-')[0] },
      summary,
      issuetype: { name: 'Sub-task' },
      description: textToAdf(descriptionLines),
    },
  };
  try {
    const res = await jpost(route`/rest/api/3/issue`, payload);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { error: `Jira responded ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    return { key: data.key, id: data.id };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}

/** Post a comment on an issue; returns {id} or {error}. */
export async function postComment(issueKeyOrId, adfBody) {
  try {
    const res = await jpost(
      route`/rest/api/3/issue/${issueKeyOrId}/comment`,
      { body: adfBody }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { error: `Jira responded ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    return { id: data.id };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}
