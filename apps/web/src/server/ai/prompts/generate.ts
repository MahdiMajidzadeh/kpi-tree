import type { IntakeAnswers } from "@kti/schema";

export const GENERATE_APPENDIX = `

Current task: GENERATE a complete first-draft KPI tree as structured output matching the provided JSON schema.

Hard constraints (validated mechanically — violations are rejected):
- Exactly ONE node with level "north_star".
- 12–30 nodes total, 2–4 levels of drivers below the North Star.
- Every node has a non-empty formula AND a non-empty reason.
- Every edge is typed; edge "source" is the parent (higher-level metric), "target" is the child.
- At least one guard node (direction: "guard") wired with a guard edge.
- The graph must be a DAG — no cycles, no self-loops, no duplicate source→target pairs.
- Node "id" values are short unique strings like "n1", "n2"; edges reference them.

Ground the tree in the reference pattern when one is provided, but fit it to THIS product — don't copy the pattern blindly. Use the product's own vocabulary (and language) for titles where natural.`;

export function buildGeneratePrompt(args: {
  productDescription: string;
  intakeAnswers: IntakeAnswers;
  patternMarkdown: string | null;
  chosenNorthStar?: string;
}): string {
  const { productDescription, intakeAnswers, patternMarkdown, chosenNorthStar } = args;
  const lines: string[] = [
    "Build a KPI tree for the following product.",
    "",
    `PRODUCT DESCRIPTION:\n${productDescription}`,
    "",
  ];
  const context: string[] = [];
  if (intakeAnswers.businessModel) context.push(`Business model: ${intakeAnswers.businessModel}`);
  if (intakeAnswers.lifecycleStage) context.push(`Lifecycle stage: ${intakeAnswers.lifecycleStage}`);
  if (intakeAnswers.monetization) context.push(`Monetization: ${intakeAnswers.monetization}`);
  if (chosenNorthStar) {
    context.push(`The user chose this North Star: ${chosenNorthStar} — build the tree around it.`);
  } else if (
    intakeAnswers.northStarIntent &&
    intakeAnswers.northStarIntent !== "help_me_choose"
  ) {
    context.push(`Intended North Star: ${intakeAnswers.northStarIntent}`);
  }
  if (context.length > 0) {
    lines.push("CONTEXT:", ...context.map((c) => `- ${c}`), "");
  }
  if (patternMarkdown) {
    lines.push(
      "REFERENCE PATTERN for this business model (canonical decompositions, standard guards, common mistakes):",
      "---",
      patternMarkdown,
      "---",
      "",
    );
  }
  lines.push("Return the complete tree as structured output now.");
  return lines.join("\n");
}

export function buildRetryPrompt(errors: string[]): string {
  return [
    "The tree you returned failed mechanical validation with these errors:",
    ...errors.map((e) => `- ${e}`),
    "",
    "Return a corrected COMPLETE tree as structured output. Fix every error; change nothing else unnecessarily.",
  ].join("\n");
}
