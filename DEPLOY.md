# Sprint Guardian — judge & self-installation guide

Goal: a judge with zero context gets the app running in **under 15 minutes**
with nothing but this file, `npm`, and an Atlassian cloud site.

## Prerequisites

- Node.js 22+ and npm
- An Atlassian cloud site (a free `*.atlassian.net` site works)

## One-time setup (≈8 minutes)

```bash
npm install -g @forge/cli@latest   # or: npx @forge/cli@latest <command>
npm install                        # backend + frontend deps
forge login                        # browser flow; a throwaway Google account is fine
forge register                     # creates the app; copy the printed app id
```

Put that app id into `manifest.yml`:

```yaml
app:
  id: ari:cloud:ecosystem::app/<your-app-id>
```

## Deploy & install (≈4 minutes)

```bash
forge deploy
forge install                      # pick your site, e.g. example.atlassian.net
```

> **Rovo chat note:** free developer sites sometimes lack Rovo chat. If so:
> `forge site provision` then `forge install --demo-site`. The issue panel and
> global page work on any site regardless.

## Installation link for judges (required by rules)

1. Run `forge deploy` against the **production** environment (`-e production`
   if needed) — judges install from production, not development.
2. Developer console (https://developer.atlassian.com/console) → your app →
   **Distribution** → enable **Sharing**.
3. Use "Start sharing your app" → copy the generated installation link into
   the Devpost submission field.

## Test script (60 seconds)

1. Open any Jira issue → **Risk Radar** panel (right side) → an audit with
   🟢/🟡/🔴 verdict, per-signal evidence, "Draft follow-up" button appears.
2. Apps menu → **Sprint Guardian** → Command Center → pick a board → **Scan now**.
3. In the Command Center, click any top-risk issue → same audit experience.
4. (If Rovo available) Rovo chat → browse agents → **Sprint Guardian** — ask
   "What are the biggest risks in my current sprint?"

## What requires extra setup (all optional)

| Feature | Needs | Fallback if absent |
|---|---|---|
| `review-load` signal | repo hosted on Bitbucket Cloud, branches/dev-status linked to issues | Signal silently absent; other 6 signals work |
| Rovo agent chat | Site with Rovo enabled (demo site always has it) | Panel + Command Center unaffected |
| Hourly board scan | nothing extra | Works after first Command Center visit |

## Uninstall

`forge uninstall` from the app directory, or remove the app from
Manage apps in the site.
