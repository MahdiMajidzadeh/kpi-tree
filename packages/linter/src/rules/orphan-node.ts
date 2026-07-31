import type { Rule } from "../types";

export const orphanNode: Rule = {
  id: "ORPHAN_NODE",
  severity: "error",
  title: "Orphan node",
  check(index) {
    // Only meaningful with exactly one North Star; MULTI_NORTH_STAR covers the rest.
    if (index.northStars.length !== 1) return [];
    const out = [];
    for (const node of index.nodes.values()) {
      if (!index.reachable.has(node.id)) {
        out.push({
          message: `"${node.title}" is not reachable from the North Star — it hangs disconnected from the tree.`,
          nodeIds: [node.id],
        });
      }
    }
    return out;
  },
};
