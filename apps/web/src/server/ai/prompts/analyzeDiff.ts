import type { Insight, Tree } from "@kti/schema";
import type { Violation } from "@kti/linter";
import type { StoredMutation } from "@/db/repo/mutations";

export const ANALYZE_DIFF_APPENDIX = `

Current task: ANALYZE the user's recent edits (a diff) against the current tree.

Judge ONLY what deterministic rules cannot: the semantic consequence of the change, business-logic gaps it opens, formula quality, whether a removal orphaned an important concept, whether an added metric duplicates existing intent.

Raise 0–3 insights via the propose_insight tool, one call each. Rules of engagement:
- MOST EDITS DESERVE ZERO INSIGHTS. Silence is the expected, correct output. Noise erodes trust.
- Never repeat or paraphrase linter findings (they are provided; the user already sees them).
- Never repeat active or dismissed insights (their titles are provided).
- Reference only node/edge ids that exist in the current tree.
- Use severity "praise" sparingly, only for genuinely strong structural moves.
Do not produce any final prose — the propose_insight calls ARE your output. If nothing is worth raising, reply "no insights".`;

export function buildDiffPrompt(args: {
  tree: Tree;
  mutations: StoredMutation[];
  lintFindings: Violation[];
  activeInsights: Insight[];
  dismissedInsights: Insight[];
}): string {
  const { tree, mutations, lintFindings, activeInsights, dismissedInsights } = args;
  const lines: string[] = [
    "The user just edited the tree. Analyze the diff.",
    "",
    "RECENT EDITS (oldest first):",
    JSON.stringify(
      mutations.map((m) => m.event),
      null,
      1,
    ),
    "",
    "CURRENT TREE:",
    JSON.stringify(
      {
        name: tree.name,
        nodes: tree.nodes.map(({ position: _p, ...rest }) => rest),
        edges: tree.edges,
      },
      null,
      1,
    ),
    "",
    "LINTER FINDINGS (already shown to the user — do NOT repeat):",
    lintFindings.length > 0
      ? lintFindings.map((v) => `- [${v.ruleId}] ${v.message}`).join("\n")
      : "(none)",
    "",
    "ACTIVE INSIGHTS (do NOT repeat):",
    activeInsights.length > 0
      ? activeInsights.map((i) => `- ${i.title}`).join("\n")
      : "(none)",
    "DISMISSED INSIGHTS (the user rejected these — do NOT re-raise):",
    dismissedInsights.length > 0
      ? dismissedInsights.map((i) => `- ${i.title}`).join("\n")
      : "(none)",
    "",
    "Raise 0–3 insights via propose_insight now, or reply \"no insights\".",
  ];
  return lines.join("\n");
}
