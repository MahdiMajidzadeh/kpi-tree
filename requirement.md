# KPI Tree Intelligence — Requirements Document

| | |
|---|---|
| **Document** | requirement.md |
| **Version** | 0.1 (Draft) |
| **Owner** | Majid |
| **Date** | 2026-07-31 |
| **Status** | For review |

---

## 1. Overview

KPI Tree Intelligence is a **local, single-user web application** that turns a plain-language product description into a structured KPI tree, lets the user edit that tree on an interactive canvas, and provides continuous AI-powered analysis of every change. The intelligence layer is the **Claude Agent SDK (TypeScript)** running in-process with the app's Node backend.

The product is a *thinking instrument*, not a dashboard: metrics carry titles, calculation formulas, and rationale — **no live data values**. Value comes from the quality of the tree's structure and the quality of the critique.

### 1.1 Problem statement

PMs build KPI trees in whiteboards and slides where they are static, structurally unvalidated, and disconnected from any reasoning about *why* each metric exists. Common failures — vanity metrics, missing counter-metrics, mathematically invalid decompositions, non-actionable leaf nodes — go unnoticed because no tool checks for them. The cost is teams optimizing the wrong numbers.

### 1.2 Product principles

1. **Structure over data.** The tree's correctness and completeness is the product. No metric values, targets, or integrations in v1.
2. **Every node justified.** A metric without a stated reason is an incomplete metric.
3. **Typed edges are non-negotiable.** Mathematical decomposition and causal influence are different relationships and must be modeled, rendered, and analyzed differently.
4. **Critique must be trustworthy.** Deterministic rules where possible; LLM judgment where rules can't reach. Never present speculation as fact.
5. **Local-first.** All state on the user's machine. The only network dependency is the Claude API (via Agent SDK).

---

## 2. Goals and non-goals

### 2.1 Goals

- G1: From product description to a complete, well-structured first-draft KPI tree in **under 90 seconds**.
- G2: Every structural mutation of the tree receives feedback — instant deterministic checks plus real-time AI insight.
- G3: The system proactively suggests metrics the tree is missing, grounded in the tree's business-model context.
- G4: A user can export a presentable artifact (image / Markdown / JSON) of any tree.
- G5: The full edit-analyze loop feels fluid: canvas interactions never block on AI calls.

### 2.2 Non-goals (v1)

- **No metric values, targets, time series, or data-source integrations.** (Explicit scope decision; revisit post-v1.)
- **No multi-user, auth, or cloud sync.** Single user, localhost.
- **No driver attribution / "what moved the North Star" analysis.** Impossible without data; do not imply it in UI copy.
- **No mobile UI.** Desktop browser only.
- **No packaged distribution (Electron/installer).** Runs via `npm run dev` / `npm start`.

---

## 3. Users and user stories

Primary persona: a **product manager or product leader** comfortable running a local Node app, holding an Anthropic API key or Claude subscription.

**Generation**
- As a PM, I want to describe my product in plain language and receive a complete KPI tree, so I can start from a strong draft instead of a blank canvas.
- As a PM, I want to answer a few optional intake questions (business model, North Star, lifecycle stage) so the generated tree fits my context rather than a generic template.

**Editing**
- As a PM, I want to add, edit, and delete metric nodes directly on a canvas, so the tree stays a living document.
- As a PM, I want to draw and re-wire edges between metrics and declare each edge's type, so the tree's logic is explicit.
- As a PM, I want undo/redo, so I can experiment without fear.

**Insight**
- As a PM, I want immediate feedback when an edit creates a structural problem, so mistakes are caught the moment they happen.
- As a PM, I want the AI to explain the *consequence* of my change (e.g., "removing Checkout CVR leaves Orders without a conversion driver"), so I understand the tree, not just the error.
- As a PM, I want each insight tied to the specific nodes it concerns, so I can jump from insight to canvas.

**Suggestion**
- As a PM, I want the app to propose missing metrics with reasons and proposed placement, so gaps in my thinking surface proactively.
- As a PM, I want to accept a suggestion in one click and see it appear correctly wired on the canvas.

**Management**
- As a PM, I want multiple trees (one per product/initiative), so the tool covers my whole portfolio.
- As a PM, I want to export a tree as PNG/SVG, Markdown, and JSON, so I can use it in decks, docs, and version control.

---

## 4. Domain model

### 4.1 Metric node

| Field | Type | Req. | Notes |
|---|---|---|---|
| `id` | string (nanoid) | ✔ | Immutable |
| `title` | string | ✔ | e.g., "Checkout Conversion Rate" |
| `formula` | string | ✔ | Human-readable calculation, e.g., `Completed Orders / Checkout Sessions` |
| `reason` | string | ✔ | Why this metric belongs in the tree |
| `level` | enum | ✔ | `north_star` \| `driver` \| `input` (leaf) |
| `direction` | enum | ✔ | `increase` \| `decrease` \| `guard` (counter-metric: hold within bounds) |
| `timeliness` | enum | ○ | `leading` \| `lagging` |
| `tags` | string[] | ○ | Free-form (e.g., `retention`, `supply-side`) |
| `origin` | enum | ✔ | `generated` \| `user` \| `suggested_accepted` — feeds analysis prompts |

Exactly **one** node per tree has `level: north_star`.

### 4.2 Edge

| Field | Type | Req. | Notes |
|---|---|---|---|
| `id` | string | ✔ | |
| `source` | node id | ✔ | Parent (higher-level metric) |
| `target` | node id | ✔ | Child (driver) |
| `type` | enum | ✔ | See below |
| `note` | string | ○ | Optional rationale for the relationship |

**Edge types:**
- `multiplicative` — children multiply to parent (Traffic × CVR = Orders)
- `additive` — children sum to parent (New GMV + Repeat GMV = GMV)
- `influence` — causal/correlational, not exact (NPS → Retention)
- `guard` — counter-metric relationship (Delivery Speed guarded by Delivery Cost)

Rendering must visually distinguish mathematical edges (`multiplicative`/`additive` — solid, with operator badge) from `influence` (dashed) and `guard` (dotted, distinct color).

### 4.3 Tree

`id`, `name`, `productDescription`, `intakeAnswers` (business model, North Star intent, lifecycle stage, monetization), `nodes[]`, `edges[]`, `createdAt`, `updatedAt`, `schemaVersion`.

The graph is a **DAG rooted at the North Star** (a node may feed multiple parents — e.g., Traffic drives both Orders and Ad Revenue). Cycles are invalid and blocked at mutation time.

### 4.4 Insight

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `treeId` | string | |
| `source` | `rule` \| `agent` | Deterministic linter vs. Claude |
| `ruleId` | string ○ | For `rule` insights (e.g., `MISSING_COUNTER_METRIC`) |
| `severity` | `error` \| `warning` \| `info` \| `praise` | `praise` = positive reinforcement for good structure |
| `title` / `body` | string | Body ≤ 3 sentences |
| `nodeIds` / `edgeIds` | string[] | For canvas highlighting |
| `triggeringMutation` | object ○ | The edit that caused it |
| `status` | `active` \| `dismissed` \| `resolved` | Auto-resolve when the underlying condition clears |
| `suggestedFix` | object ○ | Machine-applicable patch (see §5.5) |

---

## 5. Functional requirements

### FR-1: Tree generation — **P0**

**FR-1.1** Intake form: required free-text product description (min 50 chars) plus optional structured fields — business model archetype (marketplace / SaaS / media / fintech / d2c / other), intended North Star (or "help me choose"), lifecycle stage (launch / growth / maturity), monetization model.

**FR-1.2** Generation runs through the Agent SDK session (see §7) and must return a tree that conforms to the JSON schema: exactly one North Star, 2–4 driver levels, 12–30 nodes, every node with `formula` and `reason`, every edge typed, at least one `guard` node.

**FR-1.3** Generated output is schema-validated (Zod) before persisting. On validation failure the backend retries once with the validation errors appended to the prompt; on second failure, surface a readable error and preserve the raw output for debugging.

**FR-1.4** Streaming progress states in the UI (generating → validating → rendering); tree renders with an automatic layout (dagre/ELK) on completion.

**Acceptance criteria**
- [ ] Given a valid description, a schema-conformant tree renders on canvas in ≤ 90 s (p90).
- [ ] Every generated node displays a non-empty formula and reason on inspection.
- [ ] Generation never produces a cycle or a second North Star (schema-enforced).
- [ ] If "help me choose" was selected, the response includes 2–3 North Star candidates with trade-offs; the user picks before the tree is built.

### FR-2: Interactive canvas editor (React Flow) — **P0**

**FR-2.1** Canvas: pan, zoom, fit-view, minimap. Auto-layout button (re-runs dagre/ELK); manual node positions persist per tree.

**FR-2.2** Node CRUD: add via toolbar or right-click; edit all fields in a side panel opened on selection; delete with confirmation when the node has children (options: delete subtree / re-parent children to grandparent).

**FR-2.3** Edge CRUD: draw by dragging between handles; on creation, a type picker appears (default: `influence`); type editable later; invalid connections (cycles, self-loops, second parent on a `multiplicative` group when it breaks the formula) are rejected inline with a reason.

**FR-2.4** Visual encoding: North Star visually dominant (size/color); node color by `direction` (guard nodes distinct); badge for `leading`/`lagging`; edge styles per §4.2; nodes referenced by active insights get a severity-colored ring.

**FR-2.5** Undo/redo (≥ 50 steps, per tree, survives panel navigation within session). Keyboard: `Del`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+K` quick-add.

**FR-2.6** Every mutation is captured as a structured **mutation event** `{type: node_added | node_removed | node_modified | edge_added | edge_removed | edge_retyped, payload, timestamp}` — this event stream drives persistence, undo, and the analysis engine.

**Acceptance criteria**
- [ ] All canvas interactions (drag, connect, edit) respond in < 100 ms; AI calls never block canvas input.
- [ ] Deleting a mid-tree node offers subtree-delete vs. re-parent and executes correctly.
- [ ] A cycle-creating edge is rejected with an inline explanation.
- [ ] Undo restores both tree state and node positions.

### FR-3: Real-time insight engine — **P0**

Insight runs on **every edit**, implemented as two concurrent tiers so real-time never means laggy or expensive:

**FR-3.1 — Tier 1: Deterministic linter (synchronous, local, free).** Runs in-process on every mutation, in < 50 ms. It is a versioned rule engine with no LLM dependency. Initial rule set:

| Rule ID | Severity | Condition |
|---|---|---|
| `ORPHAN_NODE` | error | Node unreachable from North Star |
| `CYCLE` | error | Blocked at mutation, but re-verified |
| `MULTI_NORTH_STAR` | error | > 1 `north_star` node |
| `VANITY_METRIC` | warning | Non-leaf node with no children and no `influence` inputs |
| `MISSING_COUNTER_METRIC` | warning | A speed/volume/growth branch with no `guard` edge (heuristic: tag + direction based) |
| `INVALID_DECOMPOSITION` | warning | `multiplicative`/`additive` children whose formulas don't reference each other coherently (string-level heuristic in v1) |
| `NON_ACTIONABLE_LEAF` | info | Leaf whose formula contains only composite/external terms |
| `LAGGING_ONLY_BRANCH` | info | Branch ≥ 2 levels deep with zero `leading` nodes |
| `DEPTH_PATHOLOGY` | info | Tree depth > 5 or any node with > 7 children |
| `MISSING_REASON` | warning | Empty/placeholder `reason` |
| `DUPLICATE_METRIC` | warning | Title similarity above threshold between two nodes |

Rules auto-resolve when the condition clears. Rule set is data-driven (JSON/TS definitions) so rules can be added without touching engine code.

**FR-3.2 — Tier 2: Agent insight (asynchronous, real-time, debounced).** Every mutation is pushed to an analysis queue. The queue **debounces 1.5 s** (a burst of edits = one analysis), sends Claude a **diff-based prompt** (the mutation events since last analysis + current tree JSON + active insights, so it doesn't repeat itself), and streams back 0–3 insights. Contract:
- A new mutation while a request is in flight **cancels** the in-flight request (`AbortController`) and re-debounces — insights always describe the current tree.
- Agent insights focus on what rules can't judge: semantic consequence of the change, business-logic gaps, formula quality, whether a removal orphaned an important concept, whether an added metric duplicates intent.
- The agent is explicitly instructed to return an empty result when a change is trivial. Silence is a valid output; noise erodes trust.
- p90 latency target: insight visible ≤ 8 s after the debounce window closes.

**FR-3.3 — Insight panel.** Docked panel listing active insights grouped by severity; each shows source badge (`rule`/`AI`), links that highlight the relevant nodes/edges on click, and actions: dismiss, and **apply fix** where a `suggestedFix` exists. A canvas-wide "Deep Analysis" button triggers a full-tree review (richer prompt, higher token budget) on demand.

**Acceptance criteria**
- [ ] Tier-1 violations appear (and auto-clear) within one frame of the mutation.
- [ ] Rapid-fire edits (10 edits in 5 s) produce exactly one agent request after the burst.
- [ ] An in-flight analysis is cancelled when a newer edit arrives; stale insights never render.
- [ ] Clicking an insight pans/zooms the canvas to the referenced nodes.
- [ ] Dismissed insights do not reappear for the identical condition.

### FR-4: Metric suggestion — **P0**

**FR-4.1** "Suggest metrics" action (per-tree, and contextually per-branch via node right-click) asks the agent for 3–5 candidate metrics given the current tree, intake context, and previously rejected suggestions (don't re-suggest).

**FR-4.2** Each suggestion is a complete node candidate: title, formula, reason, level, direction, proposed parent, and proposed edge type.

**FR-4.3** Accepting a suggestion inserts the fully-wired node on canvas (marked `suggested_accepted`); rejecting records it to the tree's rejection list.

**Acceptance criteria**
- [ ] Accepted suggestion appears correctly placed and typed with zero manual wiring.
- [ ] Rejected suggestions are not repeated within the same tree.
- [ ] Suggestions respect linter rules (a suggestion may not introduce a Tier-1 error).

### FR-5: Persistence, tree management, export — **P0/P1**

**FR-5.1 (P0)** Storage: **SQLite** (via Drizzle or Prisma) in the app data directory. Tables: `trees`, `nodes`, `edges`, `insights`, `mutations` (append-only event log), `suggestions`. Autosave on every mutation; no explicit save button.

**FR-5.2 (P0)** Tree list home screen: create / rename / duplicate / delete; shows node count, active error/warning counts, last modified.

**FR-5.3 (P0)** Export: canonical **JSON** (schema-versioned, re-importable) and **Markdown** (indented hierarchy with formulas and reasons).

**FR-5.4 (P1)** Export **PNG/SVG** of the canvas; **Mermaid** flowchart export.

**FR-5.5 (P1)** Import from canonical JSON (validates schema version, migrates if older).

**FR-5.6 (P2)** Named snapshots ("Before Q3 planning") with visual diff between snapshots.

### FR-6: Settings — **P0**

Model selection for each task class (generation / real-time insight / deep analysis — sensible defaults: strongest model for generation and deep analysis, fast model for per-edit insight), debounce duration, real-time analysis on/off toggle, session token-budget cap, API key status indicator.

---

## 6. Architecture

```
┌─────────────────────────────── localhost ───────────────────────────────┐
│  Next.js (App Router, TypeScript)                                        │
│                                                                           │
│  Frontend (React)                    Backend (Node runtime)               │
│  ├─ React Flow canvas                ├─ REST/route handlers (tree CRUD)   │
│  ├─ Zustand store (tree state,       ├─ Mutation log + Tier-1 linter      │
│  │   mutation events, insights)      │   (pure TS package: @kti/linter)   │
│  ├─ Insight panel                    ├─ Analysis queue (debounce/cancel)  │
│  └─ SSE client (insight stream)      ├─ Claude Agent SDK (in-process)     │
│                                      │   └─ custom tools (§7.2)           │
│                                      └─ SQLite (Drizzle)                  │
└──────────────────────────────────────────────────────────────┬───────────┘
                                                     Anthropic API (only
                                                     external dependency)
```

- **Frontend ↔ backend insight transport:** Server-Sent Events (one stream per open tree) — simpler than WebSocket for one-directional insight push; mutations go up via normal POST.
- **`@kti/linter` is a standalone, dependency-free TS package** inside the monorepo — deliberately isolated so it can later be published, run in CI, or exposed via MCP without changes.
- Node ≥ 20. Single `npm run dev` / `npm start` boots everything.

---

## 7. Claude Agent SDK integration

### 7.1 Session strategy

- One SDK **session per open tree**, created lazily on first agent task, kept alive for conversational continuity (the agent remembers what it already critiqued — reduces repetition and tokens via automatic prompt caching).
- Session is reset when it exceeds a configurable message count or the user switches trees; a compact tree summary re-seeds the new session.
- Task classes share the session but use per-task system-prompt appendices: `generate`, `analyze_diff`, `deep_analysis`, `suggest_metrics`.

### 7.2 Custom tools exposed to the agent

The agent does **not** get file-system or bash access. It gets a minimal MCP-style tool set (defined via the SDK's custom tool mechanism):

| Tool | Purpose |
|---|---|
| `read_tree(treeId)` | Current canonical tree JSON |
| `read_mutations(treeId, since)` | Recent mutation events |
| `run_linter(treeId)` | Tier-1 results, so agent insight builds on (never repeats) rule findings |
| `read_pattern(businessModel)` | Reference tree pattern from the bundled pattern library |
| `propose_insight(...)` / `propose_suggestion(...)` | Structured, schema-validated output channels |

Forcing output through `propose_*` tools (rather than free text) is the primary mechanism for structured, renderable results.

### 7.3 Pattern library (bundled content)

Static, versioned reference trees per business-model archetype (marketplace, SaaS, subscription commerce, media, fintech) with canonical decompositions, standard counter-metrics, and common mistakes. Used by generation and by `deep_analysis` benchmarking ("marketplace trees typically carry a supply-health branch; yours doesn't"). This is proprietary product content — treated as data (JSON/MD files), editable without code changes.

### 7.4 Auth, cost, and failure behavior

- Auth via `ANTHROPIC_API_KEY` env var; if the SDK detects existing Claude Code CLI credentials, allow that path too. Key status shown in settings; never logged.
- **Cost controls:** per-session token budget (configurable, default e.g. 200k tokens/session) with a visible usage meter; real-time tier uses the fast model; diff-based prompts (never resend full history); `max_tokens` caps per task class.
- **Degraded mode:** if the API is unreachable or budget-exhausted, the app remains fully functional — canvas, Tier-1 linter, persistence, export all work; agent features show a clear "AI offline" state and queue nothing.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Canvas performance | 60 fps interactions up to 150 nodes; no AI call ever blocks input |
| Tier-1 latency | < 50 ms per mutation |
| Tier-2 latency | ≤ 8 s p90 from debounce close to first insight rendered |
| Generation | ≤ 90 s p90 end-to-end |
| Reliability | Autosave on every mutation; app restart loses nothing but in-flight analysis |
| Privacy | All data local except prompts sent to Anthropic API; no telemetry |
| Error handling | Every agent failure surfaces a human-readable, non-blocking toast + retry |
| i18n readiness (P2) | UI strings externalized; canvas and exports must handle RTL text in node titles correctly from day one (Persian metric names are a realistic input) |

---

## 9. Success metrics (self-evaluation for a local tool)

- **Activation:** first tree generated within 5 minutes of first launch.
- **Draft quality:** ≤ 30% of generated nodes deleted or heavily rewritten by the user in the first session (proxy: mutation log analysis).
- **Insight signal:** ≥ 50% of agent insights not dismissed; dismiss-rate per rule tracked to prune noisy rules.
- **Suggestion quality:** ≥ 40% suggestion acceptance rate.
- **Habitual test (personal):** the tool survives one real Digikala planning cycle as the primary KPI-tree instrument.

---

## 10. Phasing

**Phase 1 — Foundation (build first, highest risk-reduction):** canonical schema + `@kti/linter` with full rule set + unit tests; SQLite persistence; mutation event log.
**Phase 2 — Core loop:** generation (intake → Agent SDK → validated tree), React Flow canvas with full CRUD + undo, Tier-1 wiring.
**Phase 3 — Intelligence:** analysis queue (debounce/cancel/SSE), diff-based real-time insight, insight panel, suggestions.
**Phase 4 — Polish:** deep analysis + pattern benchmarking, exports (PNG/SVG/Mermaid), settings, cost meter, snapshots (P2).

---

## 11. Open questions

| # | Question | Blocking? | Owner |
|---|---|---|---|
| 1 | Formula representation: free string (v1 assumption) vs. structured expression referencing child node IDs? Structured enables real decomposition validation but complicates editing UX. | No — but decide before Phase 3, since `INVALID_DECOMPOSITION` quality depends on it | Majid |
| 2 | Should `praise`-severity insights exist in v1, or is positive reinforcement noise? | No | Majid |
| 3 | Real-time tier model default: fastest model at higher frequency vs. mid-tier debounced longer — needs empirical cost/quality test in Phase 3 | No | Eng (spike) |
| 4 | Is Persian/RTL node-title support required in v1 (affects font, canvas text, exports)? | Yes — affects Phase 2 canvas work | Majid |
| 5 | Does this local app share the canonical schema with the future SaaS/MCP product line, i.e., is the schema a public contract from day one? | Yes — dictates schema-versioning discipline in Phase 1 | Majid |

---

## 12. Out-of-scope parking lot

Metric values/targets and data integrations · driver attribution · multi-user/cloud · MCP server exposure of the linter · Claude Code skill packaging · public template gallery · Electron packaging. All deliberately excluded from v1; several are natural Phase 5+ candidates and the architecture (§6, isolated linter + versioned schema) is designed not to foreclose them.
