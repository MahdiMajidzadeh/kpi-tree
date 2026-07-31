import type { Rule } from "../types";

const PLACEHOLDER = /^(tbd|todo|n\/?a|none|\?+|[-–—.\s]*)$/i;
const MIN_LENGTH = 10;

export const missingReason: Rule = {
  id: "MISSING_REASON",
  severity: "warning",
  title: "Missing reason",
  check(index) {
    const out = [];
    for (const node of index.nodes.values()) {
      const reason = node.reason.trim();
      if (reason.length < MIN_LENGTH || PLACEHOLDER.test(reason)) {
        out.push({
          message: `"${node.title}" has no real justification. A metric without a stated reason is an incomplete metric — say why it belongs in this tree.`,
          nodeIds: [node.id],
        });
      }
    }
    return out;
  },
};
