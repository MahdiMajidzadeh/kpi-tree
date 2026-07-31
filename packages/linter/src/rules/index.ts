import type { Rule } from "../types";
import { orphanNode } from "./orphan-node";
import { cycle } from "./cycle";
import { multiNorthStar } from "./multi-north-star";
import { vanityMetric } from "./vanity-metric";
import { missingCounterMetric } from "./missing-counter-metric";
import { invalidDecomposition } from "./invalid-decomposition";
import { nonActionableLeaf } from "./non-actionable-leaf";
import { laggingOnlyBranch } from "./lagging-only-branch";
import { depthPathology } from "./depth-pathology";
import { missingReason } from "./missing-reason";
import { duplicateMetric } from "./duplicate-metric";

// Data-driven registry: adding a rule = one file + one entry here.
export const ALL_RULES: Rule[] = [
  multiNorthStar,
  cycle,
  orphanNode,
  vanityMetric,
  missingCounterMetric,
  invalidDecomposition,
  nonActionableLeaf,
  laggingOnlyBranch,
  depthPathology,
  missingReason,
  duplicateMetric,
];
