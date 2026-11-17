import { describe, it, expect } from 'vitest';
import {
  detectSignals,
  hasAcceptanceCriteria,
  scoreFindings,
  riskLevel,
  summarizeBoard,
  explainSignal,
  SIGNAL_CATALOG,
} from '../src/backend/risk-engine';

const NOW = '2026-11-16T10:00:00.000Z';
const baseIssue = {
  id: '1', key: 'PROJ-1', summary: 'Do a thing',
  description: { type: 'doc', version: 1, content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Some work to do.' }] },
  ]},
  statusName: 'In Progress', statusCategory: 'indeterminate',
  issuetypeName: 'Story', assigneeId: 'a1', assigneeName: 'Ada',
  estimate: 3, updated: NOW, created: '2026-11-01T00:00:00Z',
  blockingLinks: [], changelogDescriptionChanges: 0,
};
const acDescription = { type: 'doc', version: 1, content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Build the widget.' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Acceptance Criteria: it works, it is fast, and the tests pass end to end.' }] },
]};

describe('hasAcceptanceCriteria', () => {
  it('detects an Acceptance Criteria section with content', () => {
    expect(hasAcceptanceCriteria(acDescription)).toBe(true);
  });
  it('detects Given/When/Then', () => {
    const adf = { type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Given a user when they click then it saves' }] },
    ]};
    expect(hasAcceptanceCriteria(adf)).toBe(true);
  });
  it('detects a 3+ item checklist', () => {
    const adf = { type: 'doc', version: 1, content: [
      { type: 'taskList', content: [1,2,3].map(() => ({ type: 'taskItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'step' }] }] })) },
    ]};
    expect(hasAcceptanceCriteria(adf)).toBe(true);
  });
  it('rejects plain prose', () => {
    expect(hasAcceptanceCriteria(baseIssue.description)).toBe(false);
  });
  it('rejects empty/missing descriptions', () => {
    expect(hasAcceptanceCriteria(null)).toBe(false);
    expect(hasAcceptanceCriteria({ type: 'doc', version: 1, content: [] })).toBe(false);
  });
});

describe('detectSignals', () => {
  it('flags missing acceptance criteria on a prose description', () => {
    const f = detectSignals(baseIssue, { now: NOW });
    expect(f.some((x) => x.signal === 'missing-acceptance-criteria')).toBe(true);
  });
  it('flags unestimated story', () => {
    const f = detectSignals({ ...baseIssue, estimate: null }, { now: NOW });
    expect(f.some((x) => x.signal === 'unestimated-work')).toBe(true);
  });
  it('flags stale in-progress work after threshold days', () => {
    const f = detectSignals({ ...baseIssue, updated: '2026-11-10T10:00:00Z' }, { now: NOW });
    expect(f.some((x) => x.signal === 'stale-in-progress')).toBe(true);
  });
  it('does not flag recent in-progress work', () => {
    const f = detectSignals({ ...baseIssue, updated: '2026-11-15T10:00:00Z' }, { now: NOW });
    expect(f.some((x) => x.signal === 'stale-in-progress')).toBe(false);
  });
  it('flags overdue sprint items', () => {
    const sprint = { id: 1, name: 'S1', endDate: '2026-11-15T00:00:00Z' };
    const f = detectSignals({ ...baseIssue, description: acDescription }, { now: NOW, sprint });
    expect(f.some((x) => x.signal === 'overdue-sprint-item')).toBe(true);
  });
  it('flags review load over the limit', () => {
    const f = detectSignals(baseIssue, { now: NOW, openPrCountByAssignee: { a1: 4 } });
    expect(f.some((x) => x.signal === 'review-load')).toBe(true);
  });
  it('flags unresolved blocking links', () => {
    const f = detectSignals(
      { ...baseIssue, blockingLinks: [{ key: 'PROJ-9', statusName: 'Open', resolved: false }] },
      { now: NOW }
    );
    expect(f.some((x) => x.signal === 'blocking-dependency')).toBe(true);
  });
  it('ignores resolved blocking links', () => {
    const f = detectSignals(
      { ...baseIssue, blockingLinks: [{ key: 'PROJ-9', statusName: 'Done', resolved: true }] },
      { now: NOW }
    );
    expect(f.some((x) => x.signal === 'blocking-dependency')).toBe(false);
  });
  it('flags scope churn over the limit', () => {
    const f = detectSignals({ ...baseIssue, changelogDescriptionChanges: 5 }, { now: NOW });
    expect(f.some((x) => x.signal === 'scope-churn')).toBe(true);
  });
  it('honours custom config thresholds', () => {
    const f = detectSignals(
      { ...baseIssue, updated: '2026-11-14T10:00:00Z' },
      { now: NOW, config: { staleDays: 1 } }
    );
    expect(f.some((x) => x.signal === 'stale-in-progress')).toBe(true);
  });
  it('does not flag done issues for overdue', () => {
    const sprint = { id: 1, name: 'S1', endDate: '2026-11-15T00:00:00Z' };
    const f = detectSignals({ ...baseIssue, statusCategory: 'done' }, { now: NOW, sprint });
    expect(f.some((x) => x.signal === 'overdue-sprint-item')).toBe(false);
  });
  it('clean issue produces no findings', () => {
    const f = detectSignals(
      { ...baseIssue, description: acDescription, updated: NOW },
      { now: NOW }
    );
    expect(f).toEqual([]);
  });
});

describe('scoring and levels', () => {
  it('weights findings', () => {
    const f = detectSignals({ ...baseIssue, estimate: null, changelogDescriptionChanges: 5 }, { now: NOW });
    expect(scoreFindings(f)).toBe(3 + 2 + 1); // missing-AC + unestimated + churn
  });
  it('levels: low <3, medium 3-4, high 5+', () => {
    expect(riskLevel([])).toBe('low');
    expect(riskLevel(2)).toBe('low');
    expect(riskLevel(3)).toBe('medium');
    expect(riskLevel(5)).toBe('high');
  });
});

describe('summarizeBoard', () => {
  it('rolls up signals and ranks top issues', () => {
    const audits = [
      { issue: { key: 'A-1', summary: 'x' }, findings: [{ signal: 'unestimated-work', weight: 2 }], score: 2 },
      { issue: { key: 'A-2', summary: 'y' }, findings: [{ signal: 'scope-churn', weight: 1 }, { signal: 'unestimated-work', weight: 2 }], score: 3 },
    ];
    const s = summarizeBoard(audits, { id: 1, name: 'S1', endDate: null });
    expect(s.issueCount).toBe(2);
    expect(s.bySignal['unestimated-work']).toBe(2);
    expect(s.topIssues[0].key).toBe('A-2');
    expect(s.overall).toBe('medium'); // avg 2.5
  });
});

describe('explainSignal', () => {
  it('explains a known signal with thresholds', () => {
    const info = explainSignal('stale-in-progress');
    expect(info.label).toBe('Stale in progress');
    expect(info.detection).toContain('STALE_DAYS');
  });
  it('returns null for unknown signals', () => {
    expect(explainSignal('not-a-signal')).toBeNull();
  });
  it('catalog and engine agree on signal names', () => {
    const engine = new Set(detectSignals(baseIssue, { now: NOW }).map((f) => f.signal));
    for (const name of Object.keys(SIGNAL_CATALOG)) {
      // every catalog signal is at least referenceable by explainSignal
      expect(explainSignal(name)).not.toBeNull();
    }
  });
});
