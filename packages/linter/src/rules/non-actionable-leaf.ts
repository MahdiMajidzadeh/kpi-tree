import type { Rule } from "../types";
import { tokenize } from "../text";

// Elementary/countable terms — a leaf whose formula contains one of these is
// something a team can directly move.
const ELEMENTARY_TERMS = new Set([
  "count",
  "number",
  "#",
  "total",
  "sessions",
  "session",
  "users",
  "user",
  "visitors",
  "visitor",
  "visits",
  "visit",
  "clicks",
  "click",
  "orders",
  "order",
  "items",
  "item",
  "signups",
  "signup",
  "messages",
  "message",
  "views",
  "view",
  "listings",
  "listing",
  "sellers",
  "seller",
  "buyers",
  "buyer",
  // Persian
  "تعداد",
  "جلسات",
  "کاربران",
  "کاربر",
  "بازدید",
  "کلیک",
  "سفارش",
]);

// Composite/derived markers — formulas made only of these aren't directly
// actionable at the leaf level.
const COMPOSITE_MARKERS = new Set([
  "rate",
  "ratio",
  "%",
  "percent",
  "percentage",
  "index",
  "score",
  "nps",
  "csat",
  "average",
  "avg",
  "mean",
  "median",
  "per",
  "share",
  "margin",
  // Persian
  "نرخ",
  "شاخص",
  "امتیاز",
  "میانگین",
  "درصد",
  "سهم",
]);

export const nonActionableLeaf: Rule = {
  id: "NON_ACTIONABLE_LEAF",
  severity: "info",
  title: "Non-actionable leaf",
  check(index) {
    const out = [];
    for (const node of index.nodes.values()) {
      if (!index.isLeaf(node.id)) continue;
      if (node.level === "north_star") continue;
      const tokens = tokenize(node.formula);
      const hasElementary = tokens.some((t) => ELEMENTARY_TERMS.has(t));
      const hasComposite =
        tokens.some((t) => COMPOSITE_MARKERS.has(t)) ||
        /[%/÷]/.test(node.formula.normalize("NFKC"));
      if (!hasElementary && hasComposite) {
        out.push({
          message: `Leaf "${node.title}" is defined only in composite terms ("${node.formula}"). Leaves should bottom out in directly countable, movable quantities — decompose it further or accept it as an external input.`,
          nodeIds: [node.id],
        });
      }
    }
    return out;
  },
};
