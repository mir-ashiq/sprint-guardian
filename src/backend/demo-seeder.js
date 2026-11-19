/**
 * Sprint Guardian — demo data seeder.
 *
 * Why this exists: judges install the app on a brand-new, empty Jira site.
 * "No boards found" is a dead end for them (and for any empty site). This
 * seeder creates one Scrum project ("Sprint Guardian Demo", key SGD) with a
 * 10-issue active sprint whose issue mix is deliberately tuned so every risk
 * signal in SIGNAL_CATALOG fires at least once — the Command Center then has
 * something real to scan on the very first click.
 *
 * Design notes:
 *  - Only creates data; never deletes anything. Idempotent: if the SGD
 *    project already exists, it adds nothing and reports "already seeded".
 *  - Uses the same defensive style as jira-client: failures return {error}
 *    instead of throwing, so the UI can show a clean message.
 *  - Deliberately slow-free: no awaits in parallel loops that could race
 *    the board/sprint creation chain.
 */
import api, { route } from '@forge/api';

/** POST JSON via asApp; returns parsed body or {error}. */
async function jpost(url, payload) {
  try {
    const res = await api.asApp().requestJira(route`${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      return { error: `Jira responded ${res.status}: ${(text || '').slice(0, 200)}` };
    }
    return data || {};
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}

async function jget(url) {
  try {
    const res = await api.asApp().requestJira(route`${url}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const PROJECT_KEY = 'SGD';

/** The demo issue set: 10 issues engineered to fire every risk signal. */
function demoIssues() {
  const daysAgo = (n) => {
    const d = new Date(Date.now() - n * 86400000);
    return d.toISOString().slice(0, 10);
  };
  return [
    {
      summary: 'Payment gateway returns 422 for stored cards',
      issuetype: 'Bug',
      description: 'Reproduced on staging. Customers with saved payment methods cannot complete checkout when the token cache is cold.',
      labels: ['sg-demo'],
      // no estimate, no assignee, overdue -> multiple signals
      duedate: daysAgo(3),
    },
    {
      summary: 'Checkout page audit findings',
      issuetype: 'Story',
      description: 'Accessibility and performance pass over the new checkout flow.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 5,
    },
    {
      summary: 'Migrate reporting DB to pg16',
      issuetype: 'Task',
      description: '',
      labels: ['sg-demo'],
      // no description, no estimate, no assignee
    },
    {
      summary: 'Refund API rate limits',
      issuetype: 'Story',
      description: 'Documented rate limits for the refunds endpoint and add client backoff. Acceptance criteria: doc page published; load test at 2x peak passes.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 3,
    },
    {
      summary: 'Flaky test: cart persistence',
      issuetype: 'Bug',
      description: 'Test fails about 1 run in 5 on CI. Suspect ordering dependency.',
      labels: ['sg-demo'],
      assignee: true,
      // overdue and unestimated, and blocked by the payment-gateway bug above
      duedate: daysAgo(6),
      blockedBy: 'Payment gateway returns 422 for stored cards',
    },
    {
      summary: 'Update onboarding emails',
      issuetype: 'Task',
      description: 'New copy approved by marketing.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 1,
      duedate: daysAgo(1),
    },
    {
      summary: 'Spike: evaluate edge caching options',
      issuetype: 'Task',
      description: 'Compare CDNs for the marketing site. Timeboxed to 2 days.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 2,
    },
    {
      summary: 'Fix duplicate invoice numbers',
      issuetype: 'Bug',
      description: 'Two invoices with the same number generated in the same second. Add a sequence constraint.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 5,
    },
    {
      summary: 'Customer portal dark mode',
      issuetype: 'Story',
      description: '',
      labels: ['sg-demo'],
      // no description, no estimate
    },
    {
      summary: 'Rotate service credentials',
      issuetype: 'Task',
      description: 'Quarterly rotation; runbook in the security wiki.',
      labels: ['sg-demo'],
      assignee: true,
      estimate: 1,
      duedate: daysAgo(9),
    },
  ];
}

/** Create an ADF description from plain text. */
function adf(text) {
  return {
    type: 'doc',
    version: 1,
    content: text
      ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      : [],
  };
}

/**
 * Seed the demo project. Returns {created, projectKey, boardId, issues:[keys]}
 * or {already:true} or {error}.
 */
export async function seedDemoData() {
  // 1. Idempotency: does SGD already exist?
  const existing = await jget(`/rest/api/3/project/${PROJECT_KEY}`);
  if (existing && existing.id) {
    return { already: true, projectKey: PROJECT_KEY };
  }

  // 2. Create the project (Scrum template ships with a board).
  const project = await jpost('/rest/api/3/project', {
    key: PROJECT_KEY,
    name: 'Sprint Guardian Demo',
    projectTypeKey: 'software',
    projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-scrum-template',
    description: 'Seeded demo data for the Sprint Guardian app. Safe to delete.',
    leadAccountId: await getMyAccountId(),
    assigneeType: 'UNASSIGNED',
  });
  if (project.error) return project;
  const projectId = project.id;

  // 3. Create the 10 issues.
  const created = [];
  const createdByKey = {};
  for (const spec of demoIssues()) {
    const fields = {
      project: { id: projectId },
      summary: `[DEMO] ${spec.summary}`,
      issuetype: { name: spec.issuetype },
      description: adf(spec.description),
      labels: spec.labels,
    };
    if (spec.assignee) {
      const me = await getMyAccountId();
      if (me) fields.assignee = { id: me };
    }
    // Story points (Team-managed + company-managed boards both read this field
    // as the estimate); timetracking is a DIFFERENT field the risk engine never reads.
    if (spec.estimate) fields.customfield_10016 = spec.estimate;
    if (spec.duedate) fields.duedate = spec.duedate;
    const issue = await jpost('/rest/api/3/issue', fields);
    if (!issue.error && issue.key) {
      created.push(issue.key);
      // "is blocked by" link: remember key + target for the link pass below.
      if (spec.blockedBy && createdByKey[spec.blockedBy]) {
        await jpost('/rest/api/3/issueLink', {
          type: { name: 'Blocks' },
          inwardIssue: { key: issue.key },          // inward = the blocked one
          outwardIssue: { key: createdByKey[spec.blockedBy] }, // outward = the blocker
        });
      }
      createdByKey[spec.summary] = issue.key;
    }
  }

  // 4. Find the board the template created; poll up to 3x (board creation
  //    can lag project creation by a second or two on fresh sites).
  let boardId = null;
  for (let attempt = 0; attempt < 3 && !boardId; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2500));
    const boards = await jget(`/rest/agile/1.0/board?projectKeyOrId=${projectId}`);
    boardId = boards?.values?.[0]?.id ?? null;
  }

  let sprintName = null;
  if (boardId) {
    const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString();
    const sprint = await jpost(`/rest/agile/1.0/sprint`, {
      name: 'Demo Sprint 1 — pressure test',
      originBoardId: boardId,
      startDate: iso(-14), // started two weeks ago…
      endDate: iso(-1),    // …and ended yesterday -> overdue-sprint-item fires
    });
    if (!sprint.error && sprint.id) {
      if (created.length) {
        await jpost(`/rest/agile/1.0/sprint/${sprint.id}/issue`, { issues: created });
      }
      const started = await jpost(`/rest/agile/1.0/sprint/${sprint.id}`, {
        state: 'active',
      });
      sprintName = started.error ? null : sprint.name;
    }
  }

  return {
    created: true,
    projectKey: PROJECT_KEY,
    projectId,
    boardId,
    sprintName,
    issues: created,
    issueCount: created.length,
  };
}

/** Cache the app user's account id (needed as project lead). */
let myAccountIdCache = null;
async function getMyAccountId() {
  if (myAccountIdCache) return myAccountIdCache;
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/myself`);
    if (!res.ok) return null;
    const me = await res.json();
    myAccountIdCache = me.accountId || null;
    return myAccountIdCache;
  } catch {
    return null;
  }
}
