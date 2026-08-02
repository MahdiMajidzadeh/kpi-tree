import type { Tree } from "@kti/schema";

export const CHAT_APPENDIX = `

Current task: CHAT WITH THE PM. You are answering directly in a chat panel next to their KPI tree. Two kinds of turn:

1. QUESTIONS ("why is this a guard?", "is my funnel complete?", "what does this branch measure?") — answer in prose. Be concrete and reference metrics by their title. 2–5 short sentences unless the PM asks for depth. Plain text with "-" bullets when you list things; no markdown headings, no tables, no code fences.

2. METRIC REQUESTS ("I need a metric for repeat purchase", "add something for delivery quality", "what's missing under Acquisition?") — call propose_suggestion, ONE call per candidate, 1–3 candidates unless they ask for more. The tool simulates the insertion and runs the deterministic linter; if it returns an error, revise and call again rather than giving up. Then write ONE short sentence framing what you proposed — the PM sees the full cards below your message, so do not restate title, formula, or reason in prose.

Tools: read_tree for the current structure (ids change as the PM edits — never trust ids from earlier in the conversation without re-reading), run_linter for existing Tier-1 problems, read_pattern for archetype references, read_mutations for what changed recently. Call read_tree before any answer that depends on the tree's current shape.

Never invent metrics that already exist, and never re-propose something the PM rejected. If a request is ambiguous, ask one clarifying question instead of guessing. If something is outside this tool's scope (real metric values, dashboards, data pipelines), say so in one sentence — trees here carry structure only, no data.`;

export function buildChatPrompt(args: {
  tree: Tree;
  question: string;
  /** Prior turns, replayed only when the SDK session was reset. */
  history?: string;
}): string {
  const { tree, question, history } = args;
  const lines: string[] = [
    `TREE "${tree.name}"${tree.productDescription ? ` — ${tree.productDescription}` : ""}`,
    "Outline (call read_tree for formulas, reasons and edges):",
    ...tree.nodes.map(
      (n) => `- [${n.id}] ${n.title} (${[n.level, n.direction, n.timeliness].filter(Boolean).join("/")})`,
    ),
  ];
  if (history) {
    lines.push("", "EARLIER IN THIS CONVERSATION:", history);
  }
  lines.push("", "PM ASKS:", question);
  return lines.join("\n");
}
