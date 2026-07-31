import type { IntakeAnswers } from "@kti/schema";

export const NORTH_STAR_APPENDIX = `

Current task: propose NORTH STAR CANDIDATES as structured output. Offer 2–3 genuinely different candidates. For each: a title, a human-readable formula, and 1–2 sentences of trade-offs (what optimizing it emphasizes and what it risks neglecting). Do NOT build the tree yet.`;

export function buildNorthStarPrompt(args: {
  productDescription: string;
  intakeAnswers: IntakeAnswers;
}): string {
  const lines = [
    "Suggest North Star candidates for this product.",
    "",
    `PRODUCT DESCRIPTION:\n${args.productDescription}`,
  ];
  if (args.intakeAnswers.businessModel) {
    lines.push(`Business model: ${args.intakeAnswers.businessModel}`);
  }
  if (args.intakeAnswers.lifecycleStage) {
    lines.push(`Lifecycle stage: ${args.intakeAnswers.lifecycleStage}`);
  }
  if (args.intakeAnswers.monetization) {
    lines.push(`Monetization: ${args.intakeAnswers.monetization}`);
  }
  return lines.join("\n");
}
