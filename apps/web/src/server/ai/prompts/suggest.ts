import type { Tree } from "@kti/schema";

export const SUGGEST_APPENDIX = `

Current task: SUGGEST MISSING METRICS. Study the current tree (read_tree; use read_pattern for the archetype if helpful), then propose 3–5 candidate metrics via the propose_suggestion tool — ONE call per candidate.

Each candidate must be complete: title, human-readable formula, a reason a PM would defend, level, direction, timeliness if clear, an existing parent node id, and the edge type that honestly describes the relationship (math edges only when the arithmetic is exact).

The tool simulates the insertion and runs the deterministic linter. If it returns an error, fix the candidate and propose again — do not give up after one rejection. Never re-suggest titles the user already rejected. Do not produce prose output; the tool calls ARE your output.`;

export function buildSuggestPrompt(args: {
  tree: Tree;
  branchNodeId?: string;
  rejectedTitles: string[];
}): string {
  const { tree, branchNodeId, rejectedTitles } = args;
  const lines: string[] = [
    "Suggest metrics this KPI tree is missing.",
    "",
    "CURRENT TREE:",
    JSON.stringify(
      {
        name: tree.name,
        productDescription: tree.productDescription,
        intakeAnswers: tree.intakeAnswers,
        nodes: tree.nodes.map(({ position: _p, ...rest }) => rest),
        edges: tree.edges,
      },
      null,
      1,
    ),
  ];
  if (branchNodeId) {
    const branch = tree.nodes.find((n) => n.id === branchNodeId);
    lines.push(
      "",
      `FOCUS: suggest only within the branch rooted at "${branch?.title ?? branchNodeId}" (node id ${branchNodeId}) — parents must be that node or its descendants.`,
    );
  }
  if (rejectedTitles.length > 0) {
    lines.push(
      "",
      "PREVIOUSLY REJECTED (do not re-suggest these or trivial variants):",
      ...rejectedTitles.map((t) => `- ${t}`),
    );
  }
  lines.push("", "Propose 3–5 candidates via propose_suggestion now.");
  return lines.join("\n");
}
