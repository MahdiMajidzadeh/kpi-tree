# KPI Tree Intelligence

A local, single-user web app that turns a plain-language product description into a structured KPI tree, lets you edit it on an interactive canvas, and critiques every change — deterministic lint rules instantly, Claude-powered insight in the background. Structure only: metrics carry titles, formulas, and reasons, never data values. See [requirement.md](requirement.md) for the full spec.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Requires Node ≥ 20.

### AI features

The intelligence layer runs on the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/typescript) in-process. Auth, in order of preference:

1. `ANTHROPIC_API_KEY` — put it in `apps/web/.env.local` (or export it) and restart.
2. Existing Claude Code CLI credentials — if you're logged in via `claude` on this machine, the SDK picks that up automatically. If you see "AI offline … OAuth access token has expired", re-run `claude` and log in again.

Without either, everything except AI works: canvas editing, the Tier-1 linter, autosave, import/export, snapshots. AI panels show a clear offline state.

## What's inside

```
packages/schema    @kti/schema — Zod domain contract (nodes, typed edges, trees, mutations, insights)
packages/linter    @kti/linter — dependency-free rule engine (11 rules, <50ms at 150 nodes)
apps/web           Next.js app — React Flow canvas, SQLite (Drizzle) persistence,
                   SSE insight stream, Agent SDK generation/analysis/suggestions
apps/web/content/patterns   Editable pattern library per business-model archetype
apps/web/data/kti.db         Your local database (gitignored; KTI_DB_PATH overrides)
```

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm start            # serve the production build
npm test             # vitest (linter rules, schema, persistence, analysis queue)
npm run typecheck    # strict TS across all workspaces
```

## Notes

- **Every mutation autosaves** — there is no save button. The mutation log is append-only; undo/redo (≥50 steps) replays inverse events, so history stays truthful.
- **Edge types matter**: multiplicative/additive edges render solid with an operator badge and are validated against parent formulas; influence is dashed; guard (counter-metric) is dotted amber.
- **Persian/RTL metric titles** are first-class on canvas and in every export (PNG/SVG embed the Vazirmatn font).
- Model defaults (Settings): Opus for generation & deep analysis, Haiku for real-time insight, Sonnet for suggestions. Per-tree session token budget defaults to 200k.
