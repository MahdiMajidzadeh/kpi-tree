import { NextResponse } from "next/server";
import { z } from "zod";
import { IntakeAnswersSchema } from "@kti/schema";
import { createTree } from "@/db/repo/trees";
import { aiStatus } from "@/server/ai/status";
import { runGeneration, runNorthStarCandidates } from "@/server/ai/generation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GenerateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  productDescription: z.string().min(50, "Describe the product in at least 50 characters."),
  intakeAnswers: IntakeAnswersSchema.default({}),
  chosenNorthStar: z.string().optional(),
});

export async function POST(request: Request) {
  const body = GenerateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const { name, productDescription, intakeAnswers, chosenNorthStar } = body.data;

  const status = aiStatus();
  if (status.status === "offline") {
    return NextResponse.json(
      { error: `AI is offline: ${status.reason ?? "unknown reason"}` },
      { status: 503 },
    );
  }

  // Two-step "help me choose" flow (FR-1 acceptance).
  if (intakeAnswers.northStarIntent === "help_me_choose" && !chosenNorthStar) {
    const result = await runNorthStarCandidates({ productDescription, intakeAnswers });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ candidates: result.candidates });
  }

  const tree = createTree({
    name: name ?? "Generating…",
    productDescription,
    intakeAnswers,
  });

  // Detached: progress streams over the tree's SSE channel.
  void runGeneration({
    treeId: tree.id,
    productDescription,
    intakeAnswers,
    ...(chosenNorthStar !== undefined ? { chosenNorthStar } : {}),
    nameWasProvided: Boolean(name),
  });

  return NextResponse.json({ treeId: tree.id }, { status: 202 });
}
