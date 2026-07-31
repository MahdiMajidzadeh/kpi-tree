import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { IntakeAnswersSchema, type MetricNode } from "@kti/schema";
import { createTree, listTrees } from "@/db/repo/trees";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ trees: listTrees() });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  productDescription: z.string().optional(),
  intakeAnswers: IntakeAnswersSchema.optional(),
  // "blank" seeds a placeholder North Star so the canvas is never empty.
  blank: z.boolean().default(true),
});

export async function POST(request: Request) {
  const body = CreateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const { name, productDescription, intakeAnswers, blank } = body.data;

  const seedNodes: MetricNode[] = blank
    ? [
        {
          id: nanoid(),
          title: "North Star",
          formula: "Define the calculation",
          reason: "",
          level: "north_star",
          direction: "increase",
          tags: [],
          origin: "user",
          position: { x: 0, y: 0 },
        },
      ]
    : [];

  const tree = createTree({
    name,
    ...(productDescription !== undefined ? { productDescription } : {}),
    ...(intakeAnswers !== undefined ? { intakeAnswers } : {}),
    nodes: seedNodes,
  });
  return NextResponse.json({ tree }, { status: 201 });
}
