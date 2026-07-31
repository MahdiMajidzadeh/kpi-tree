import type { Rule } from "../types";

export const cycle: Rule = {
  id: "CYCLE",
  severity: "error",
  title: "Cycle in tree",
  check(index) {
    if (index.cycleNodes.size === 0) return [];
    const nodeIds = [...index.cycleNodes];
    const titles = nodeIds.map((id) => index.nodes.get(id)?.title ?? id);
    const edgeIds = [...index.edges.values()]
      .filter((e) => index.cycleNodes.has(e.source) && index.cycleNodes.has(e.target))
      .map((e) => e.id);
    return [
      {
        message: `The tree contains a cycle involving: ${titles.join(", ")}. A KPI tree must be a DAG rooted at the North Star.`,
        nodeIds,
        edgeIds,
      },
    ];
  },
};
