# Changelog

## 1.2.0 — 2026-11-19 (judge-experience hardening round 2)
- Fixed: blocking-dependency now reads link data in both directions
  (inward + outward), so real "is blocked by" links are detected.
- Fixed: demo seeder writes story points (customfield_10016) instead of
  timetracking — the unestimated-work signal now fires only where intended.
- Fixed: demo sprint has real dates (started 14d ago, ended yesterday) so
  overdue-sprint-item fires on the demo board.
- Added: demo seeder links two issues with a Blocks pair so
  blocking-dependency fires without any manual setup.
- Added: board polling after seeding (3 attempts) — no dead ends on fresh sites.
- UI: human-readable signal labels, risk-trend sparkline, deep links to
  created subtasks, humanized error hints, panel onboarding line.
- Actions: act-run-board-scan timeout raised to 120s for large boards.
- Review-load attribution matches PR authors to assignees by name first.
- CI: GitHub Actions workflow (install, unit tests with coverage, manifest
  parse check).
- Docs: architecture diagram (Mermaid), judge quick path at top, CHANGELOG.

## 1.1.0 — 2026-11-18
- Empty-site demo-data seeder (SGD project, 10-issue tuned sprint).
- write:sprint scope for the seeder; README judge quick path.

## 1.0.0 — 2026-11-16
- Initial release: Risk Radar panel, Command Center, Rovo agent with 6
  actions + 2 skills, MCP server with 6 tools, scheduled + event triggers,
  pure risk engine with 23 unit tests.
