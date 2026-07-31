import type { BusinessModel } from "@kti/schema";

export const DEEP_ANALYSIS_APPENDIX = `

Current task: DEEP ANALYSIS — a full-tree structural review, richer than the per-edit pass.

Method:
1. read_tree for the full current tree.
2. run_linter — its findings are already visible to the user; NEVER restate them.
3. If an archetype is named, read_pattern and benchmark the tree against it: name concretely which canonical branches, guards, or leading indicators are missing (e.g. "marketplace trees typically carry a supply-health branch; yours doesn't").
4. Judge: decomposition quality, formula coherence, guard coverage, leading/lagging balance, duplicated intent, actionability of leaves.

Raise up to 8 insights via propose_insight — one call each, most important first. Include "praise" for genuinely strong structure. Anchor every insight to specific node ids. Do not produce prose output; the tool calls ARE your output.`;

export function buildDeepAnalysisPrompt(archetype: BusinessModel | undefined): string {
  return [
    "Run a deep structural review of this KPI tree.",
    archetype && archetype !== "other"
      ? `The declared business-model archetype is "${archetype}" — benchmark against its reference pattern.`
      : "No archetype declared — judge on first principles.",
  ].join("\n");
}
