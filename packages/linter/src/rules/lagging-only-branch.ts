import type { Rule } from "../types";

export const laggingOnlyBranch: Rule = {
  id: "LAGGING_ONLY_BRANCH",
  severity: "info",
  title: "Lagging-only branch",
  check(index) {
    if (index.northStars.length !== 1) return [];
    const root = index.northStars[0]!;
    const out = [];
    for (const branchEdge of index.children(root.id)) {
      const branchRoot = index.nodes.get(branchEdge.target)!;
      // "Branch ≥ 2 levels deep": the branch root has children of its own.
      if (index.subtreeHeight(branchRoot.id) < 1) continue;
      const members = [branchRoot.id, ...index.descendants(branchRoot.id)];
      const annotated = members.filter(
        (id) => index.nodes.get(id)!.timeliness !== undefined,
      );
      // Only judge branches the user has bothered to annotate — otherwise
      // every fresh tree would light up.
      if (annotated.length === 0) continue;
      const hasLeading = annotated.some(
        (id) => index.nodes.get(id)!.timeliness === "leading",
      );
      if (!hasLeading) {
        out.push({
          message: `The "${branchRoot.title}" branch has only lagging metrics. Without a leading indicator you'll learn about problems after they've already hit the North Star.`,
          nodeIds: [branchRoot.id],
        });
      }
    }
    return out;
  },
};
