import { TreeIndex } from "./context";
import { fingerprint } from "./fingerprint";
import type { LinterTree, Rule, Violation } from "./types";
import { ALL_RULES } from "./rules";

/**
 * Run the deterministic Tier-1 linter. Stateless: returns the complete
 * current violation set; auto-resolve is reconciled by the caller via
 * fingerprints.
 */
export function lintTree(tree: LinterTree, rules: Rule[] = ALL_RULES): Violation[] {
  const index = new TreeIndex(tree);
  const violations: Violation[] = [];
  for (const rule of rules) {
    for (const raw of rule.check(index)) {
      const nodeIds = raw.nodeIds ?? [];
      const edgeIds = raw.edgeIds ?? [];
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        title: rule.title,
        message: raw.message,
        nodeIds,
        edgeIds,
        fingerprint: fingerprint(rule.id, nodeIds, edgeIds),
      });
    }
  }
  return violations;
}
