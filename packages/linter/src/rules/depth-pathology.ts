import type { Rule } from "../types";

const MAX_DEPTH = 5; // levels below the North Star
const MAX_CHILDREN = 7;

export const depthPathology: Rule = {
  id: "DEPTH_PATHOLOGY",
  severity: "info",
  title: "Depth pathology",
  check(index) {
    const out = [];

    let deepest: { id: string; d: number } | null = null;
    for (const [id, d] of index.depth) {
      if (!deepest || d > deepest.d) deepest = { id, d };
    }
    if (deepest && deepest.d > MAX_DEPTH) {
      const node = index.nodes.get(deepest.id)!;
      out.push({
        message: `The tree is ${deepest.d} levels deep (e.g., "${node.title}"). Beyond ${MAX_DEPTH} levels a KPI tree stops being a communication tool — consider collapsing intermediate layers.`,
        nodeIds: [deepest.id],
      });
    }

    for (const node of index.nodes.values()) {
      const childCount = index.children(node.id).length;
      if (childCount > MAX_CHILDREN) {
        out.push({
          message: `"${node.title}" has ${childCount} direct children. More than ${MAX_CHILDREN} drivers under one metric usually means a missing intermediate grouping.`,
          nodeIds: [node.id],
        });
      }
    }
    return out;
  },
};
