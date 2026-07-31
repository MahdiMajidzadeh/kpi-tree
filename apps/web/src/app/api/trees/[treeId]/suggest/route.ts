import { NextResponse } from "next/server";
import { z } from "zod";
import { getTree } from "@/db/repo/trees";
import { getSettings } from "@/server/settings";
import { aiStatus } from "@/server/ai/status";
import { budgetExhausted } from "@/server/ai/sessions";
import { getAnalysisQueue } from "@/server/ai/analysisQueue";
import { runAgentQuery } from "@/server/ai/client";
import { createKtiToolServer } from "@/server/ai/tools/server";
import { rejectedTitles } from "@/server/ai/suggestions";
import { BASE_SYSTEM } from "@/server/ai/prompts/base";
import { SUGGEST_APPENDIX, buildSuggestPrompt } from "@/server/ai/prompts/suggest";
import { publish } from "@/server/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ treeId: string }> };

const BodySchema = z.object({ branchNodeId: z.string().optional() });

export async function POST(request: Request, { params }: Params) {
  const { treeId } = await params;
  const body = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const tree = getTree(treeId);
  if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const status = aiStatus();
  if (status.status === "offline") {
    return NextResponse.json(
      { error: `AI is offline: ${status.reason ?? "unknown"}` },
      { status: 503 },
    );
  }
  if (budgetExhausted(treeId)) {
    return NextResponse.json(
      { error: "Session token budget exhausted for this tree." },
      { status: 409 },
    );
  }
  const branchNodeId = body.data.branchNodeId;
  if (branchNodeId && !tree.nodes.some((n) => n.id === branchNodeId)) {
    return NextResponse.json({ error: "Branch node not found" }, { status: 404 });
  }

  const settings = getSettings();
  // Serialized on the tree's queue: never two concurrent session resumes.
  const result = await getAnalysisQueue(treeId).enqueueExclusive(() =>
    runAgentQuery({
      treeId,
      prompt: buildSuggestPrompt({
        tree,
        ...(branchNodeId !== undefined ? { branchNodeId } : {}),
        rejectedTitles: rejectedTitles(treeId),
      }),
      systemPrompt: BASE_SYSTEM + SUGGEST_APPENDIX,
      model: settings.models.suggestions,
      maxTurns: 16,
      mcpServer: createKtiToolServer(
        { treeId, cancelled: () => false },
        { proposeSuggestion: true },
      ),
    }),
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.kind === "offline" ? 503 : result.kind === "budget" ? 409 : 502 },
    );
  }
  publish(treeId, { type: "suggestions_done", count: 0 });
  return NextResponse.json({ ok: true });
}
