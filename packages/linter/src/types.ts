// Structural input types. Deliberately NOT imported from @kti/schema:
// this package has zero dependencies so it can later be published, run in
// CI, or exposed via MCP unchanged. Canonical trees satisfy these shapes
// structurally (guarded by a type-assertion test in @kti/schema).

export type LinterLevel = "north_star" | "driver" | "input";
export type LinterDirection = "increase" | "decrease" | "guard";
export type LinterEdgeType = "multiplicative" | "additive" | "influence" | "guard";

export interface LinterNode {
  id: string;
  title: string;
  formula: string;
  reason: string;
  level: LinterLevel;
  direction: LinterDirection;
  timeliness?: "leading" | "lagging";
  tags?: string[];
}

// source = parent (higher-level metric), target = child (driver).
export interface LinterEdge {
  id: string;
  source: string;
  target: string;
  type: LinterEdgeType;
}

export interface LinterTree {
  nodes: LinterNode[];
  edges: LinterEdge[];
}

export type RuleSeverity = "error" | "warning" | "info";

export type RuleId =
  | "ORPHAN_NODE"
  | "CYCLE"
  | "MULTI_NORTH_STAR"
  | "VANITY_METRIC"
  | "MISSING_COUNTER_METRIC"
  | "INVALID_DECOMPOSITION"
  | "NON_ACTIONABLE_LEAF"
  | "LAGGING_ONLY_BRANCH"
  | "DEPTH_PATHOLOGY"
  | "MISSING_REASON"
  | "DUPLICATE_METRIC";

export interface Violation {
  ruleId: RuleId;
  severity: RuleSeverity;
  title: string;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  /** Stable identity of the condition: ruleId + sorted node/edge ids. */
  fingerprint: string;
}

/** What a rule's check() returns; the engine stamps rule metadata + fingerprint. */
export interface RawViolation {
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

import type { TreeIndex } from "./context";

export interface Rule {
  id: RuleId;
  severity: RuleSeverity;
  title: string;
  check(index: TreeIndex): RawViolation[];
}
