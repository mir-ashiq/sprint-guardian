/**
 * Sprint Guardian — UI Kit frontend.
 * One resource serves both surfaces:
 *  - jira:globalPage  → Command Center (board picker, summary, trend, top risks)
 *  - jira:issuePanel  → Risk Radar (audit of the open issue + actions)
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Stack, Inline, Button, Lozenge, SectionMessage, Spinner,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const LEVEL_APPEARANCE = { low: 'success', medium: 'new', high: 'removed' };
const LEVEL_EMOJI = { low: '🟢', medium: '🟡', high: '🔴' };

function SignalRow({ f, onDraft, onExplain }) {
  return (
    <Stack space="small" xcss={{ backgroundColor: 'elevation.surface.sunken', padding: 'space.150', borderRadius: '3px' }}>
      <Inline space="space.100" grow="fill" blockAlign="center">
        <Lozenge appearance={f.severity === 'high' ? 'removed' : f.severity === 'medium' ? 'new' : 'default'}>{f.severity}</Lozenge>
        <Text weight="medium">{f.signal}</Text>
      </Inline>
      <Text size="small" as="p">{f.evidence}</Text>
      <Text size="small" as="p">→ {f.suggestedAction}</Text>
      {onDraft && (
        <Inline>
          <Button appearance="primary" spacing="compact" onClick={() => onDraft(f)}>Draft follow-up</Button>
          {onExplain && <Button spacing="compact" onClick={() => onExplain(f.signal)}>Why?</Button>}
        </Inline>
      )}
    </Stack>
  );
}

function AuditView({ issueKey, compact }) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setBusy(true);
    setReport(await invoke('auditIssue', { issueKeyOrId: issueKey }));
    setBusy(false);
  };
  useEffect(() => { load(); }, [issueKey]);

  if (busy && !report) return <Spinner size="medium" label="Auditing…" />;
  if (!report) return null;
  if (report.error) return <SectionMessage appearance="warning" title="Audit unavailable"><Text as="p">{report.error}</Text></SectionMessage>;

  const draft = async (f) => {
    setBusy(true);
    const res = await invoke('draftFollowUp', {
      parentIssueKey: issueKey,
      summary: `Address ${f.signal} on ${issueKey}`,
      riskSignal: f.signal,
      findingsJson: JSON.stringify([f]),
    });
    setMsg(res); setBusy(false);
  };

  return (
    <Stack space="space.200">
      <Inline space="space.100" blockAlign="center" grow="fill">
        <Text size="large" weight="semibold">{LEVEL_EMOJI[report.level]} {report.level.toUpperCase()} RISK</Text>
        <Lozenge appearance={LEVEL_APPEARANCE[report.level]}>score {report.score}</Lozenge>
        <Text size="small">{report.findings.length} signals</Text>
      </Inline>
      {report.findings.length === 0 && (
        <SectionMessage appearance="success" title="Clean"><Text as="p">No risk signals detected on this issue. Ship with confidence.</Text></SectionMessage>
      )}
      {report.findings.map((f) => (
        <SignalRow key={f.signal} f={f} onDraft={compact ? undefined : draft} />
      ))}
      {msg && <SectionMessage appearance="info" title="Action"><Text as="p">{String(msg)}</Text></SectionMessage>}
    </Stack>
  );
}

function CommandCenter() {
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke('getBoards').then((r) => {
      setBoards(r.boards || []);
      if (r.boards?.length) setBoardId(String(r.boards[0].id));
    });
  }, []);
  useEffect(() => {
    if (boardId) invoke('getBoardState', { boardId }).then(setState);
  }, [boardId]);

  const scanNow = async () => {
    setBusy(true);
    const r = await invoke('scanBoard', { boardId });
    setState((s) => ({ ...s, latest: { at: r.scannedAt, summary: r.summary } }));
    setBusy(false);
  };

  const s = state?.latest?.summary;
  return (
    <Stack space="space.300">
      <Inline space="space.200" blockAlign="center" grow="fill">
        <Heading as="h2">🛡️ Sprint Guardian — Command Center</Heading>
        {boardId && <Button appearance="primary" isDisabled={busy} onClick={scanNow}>{busy ? 'Scanning…' : 'Scan now'}</Button>}
      </Inline>
      <Inline space="space.100">
        {boards.map((b) => (
          <Button key={b.id} appearance={String(b.id) === boardId ? 'primary' : 'default'} spacing="compact" onClick={() => setBoardId(String(b.id))}>{b.name}</Button>
        ))}
      </Inline>
      {!s && !state && <Spinner label="Loading last scan…" />}
      {!s && state && (
        <SectionMessage appearance="information" title="No scan yet">
          <Text as="p">This board has no stored scan. Click “Scan now” to audit the active sprint — the first scan takes a few seconds.</Text>
        </SectionMessage>
      )}
      {s && (
        <Stack space="space.200">
          <Inline space="space.200" blockAlign="center">
            <Text size="xlarge" weight="semibold">{LEVEL_EMOJI[s.overall]} {s.overall.toUpperCase()}</Text>
            <Text>sprint “{s.sprint?.name || '—'}” · {s.issueCount} issues · avg risk {s.avgScore}</Text>
            {state?.latest?.at && <Text size="small">scanned {String(state.latest.at).slice(0, 16).replace('T', ' ')}</Text>}
          </Inline>
          <Heading as="h4">Signals across the board</Heading>
          <Stack space="space.050">
            {Object.entries(s.bySignal).sort((a, b) => b[1] - a[1]).map(([sig, n]) => (
              <Inline key={sig} space="space.100" blockAlign="center">
                <Lozenge>{n}×</Lozenge>
                <Text>{sig}</Text>
              </Inline>
            ))}
            {Object.keys(s.bySignal).length === 0 && <Text>No signals — clean sprint.</Text>}
          </Stack>
          <Heading as="h4">Highest-risk issues</Heading>
          <Stack space="space.050">
            {s.topIssues.map((t) => (
              <Inline key={t.key} space="space.100" blockAlign="center">
                <Lozenge appearance={t.score >= 5 ? 'removed' : 'new'}>{t.score}</Lozenge>
                <Text weight="medium">{t.key}</Text>
                <Text size="small">{t.summary}</Text>
                <Text size="small" as="em">{t.signals.join(', ')}</Text>
              </Inline>
            ))}
          </Stack>
          <Text size="small" as="p">Trend ({(state?.trend || []).length} snapshots stored): {' '}
            {(state?.trend || []).slice(-10).map((p) => `${p.avgScore}`).join(' → ') || 'collecting…'}
          </Text>
          <SectionMessage appearance="information" title="Talk to the agent">
            <Text as="p">Open Rovo Chat → Browse Agents → enable “Sprint Guardian”, then ask: “What are the biggest risks in my current sprint?” The agent uses the same actions as this page and can create follow-up subtasks for you.</Text>
          </SectionMessage>
        </Stack>
      )}
    </Stack>
  );
}

function App() {
  const context = useProductContext();
  const type = context?.type || '';
  if (type.startsWith('jira:issuePanel')) {
    const issueKey = context?.extension?.issue?.key;
    return (
      <Stack space="space.200">
        <Heading as="h4">🛡️ Risk Radar</Heading>
        {issueKey ? <AuditView issueKey={issueKey} compact={false} /> : <Text>Open on an issue to audit it.</Text>}
      </Stack>
    );
  }
  return <CommandCenter />;
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
