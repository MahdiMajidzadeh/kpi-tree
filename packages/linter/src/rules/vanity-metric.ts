import type { Rule } from "../types";

export const vanityMetric: Rule = {
  id: "VANITY_METRIC",
  severity: "warning",
  title: "Vanity metric",
  check(index) {
    const out = [];
    for (const node of index.nodes.values()) {
      if (node.level === "input") continue;
      if (index.children(node.id).length > 0) continue;
      // A single-node tree is just a starting point, not a vanity metric.
      if (node.level === "north_star" && index.nodes.size === 1) continue;
      out.push({
        message: `"${node.title}" is a ${node.level === "north_star" ? "North Star" : "driver"} with nothing driving it — a number you can watch but not act on. Decompose it or connect its drivers.`,
        nodeIds: [node.id],
      });
    }
    return out;
  },
};
