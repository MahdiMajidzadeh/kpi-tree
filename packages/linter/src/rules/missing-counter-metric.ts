import type { Rule } from "../types";
import { tokenize } from "../text";

// Data-driven keyword table (extendable without touching the rule logic).
// A branch rooted at an `increase` node matching these terms should carry a
// guard somewhere in its subtree.
export const GROWTH_KEYWORDS = new Set([
  // English
  "growth",
  "speed",
  "velocity",
  "volume",
  "acquisition",
  "conversion",
  "gmv",
  "orders",
  "order",
  "signups",
  "signup",
  "traffic",
  "throughput",
  "sales",
  "revenue",
  // Persian
  "رشد",
  "سرعت",
  "حجم",
  "تبدیل",
  "سفارش",
  "سفارشها",
  "درآمد",
  "ترافیک",
  "فروش",
]);

function matchesGrowthKeywords(title: string, tags: string[] | undefined): boolean {
  for (const token of tokenize(title)) {
    if (GROWTH_KEYWORDS.has(token)) return true;
  }
  for (const tag of tags ?? []) {
    for (const token of tokenize(tag)) {
      if (GROWTH_KEYWORDS.has(token)) return true;
    }
  }
  return false;
}

export const missingCounterMetric: Rule = {
  id: "MISSING_COUNTER_METRIC",
  severity: "warning",
  title: "Missing counter-metric",
  check(index) {
    const matching = new Set<string>();
    for (const node of index.nodes.values()) {
      if (node.direction !== "increase") continue;
      if (matchesGrowthKeywords(node.title, node.tags)) matching.add(node.id);
    }

    const out = [];
    for (const id of matching) {
      // Fire once per branch: skip if any ancestor also matches.
      if (hasMatchingAncestor(index, id, matching)) continue;

      const branch = new Set([id, ...index.descendants(id)]);
      let guarded = false;
      for (const memberId of branch) {
        const member = index.nodes.get(memberId)!;
        if (member.direction === "guard") {
          guarded = true;
          break;
        }
        const incident = [...index.children(memberId), ...index.parents(memberId)];
        if (incident.some((e) => e.type === "guard")) {
          guarded = true;
          break;
        }
      }
      if (guarded) continue;

      const node = index.nodes.get(id)!;
      out.push({
        message: `"${node.title}" is a growth/volume branch with no counter-metric. Optimizing it unchecked invites quality or cost regressions — add a guard metric (e.g., cost, quality, or satisfaction bound).`,
        nodeIds: [id],
      });
    }
    return out;
  },
};

function hasMatchingAncestor(
  index: Parameters<Rule["check"]>[0],
  id: string,
  matching: Set<string>,
): boolean {
  const seen = new Set<string>();
  const stack = index.parents(id).map((e) => e.source);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (matching.has(cur)) return true;
    for (const e of index.parents(cur)) stack.push(e.source);
  }
  return false;
}
