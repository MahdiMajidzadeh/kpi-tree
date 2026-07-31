import { NextResponse } from "next/server";
import { z } from "zod";
import { MutationBatchSchema } from "@kti/schema";
import { applyMutations } from "@/server/apply-mutations";
import { notifyMutationApplied } from "@/server/mutation-hooks";
import { getAnalysisQueue } from "@/server/ai/analysisQueue";
import { publish } from "@/server/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { treeId } = await params;
  const body = MutationBatchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }

  const result = applyMutations(treeId, body.data.events);
  if (!result) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  // Non-blocking: broadcast rule-insight changes and feed the AI queue.
  notifyMutationApplied(treeId, result);
  for (const insight of result.added) {
    publish(treeId, { type: "insight_added", insight });
  }
  for (const insight of result.resolved) {
    publish(treeId, { type: "insight_resolved", insightId: insight.id });
  }
  getAnalysisQueue(treeId).notifyMutation();

  return NextResponse.json({
    ok: true,
    latestSeq: result.latestSeq,
    added: result.added,
    resolved: result.resolved.map((i) => i.id),
  });
}
