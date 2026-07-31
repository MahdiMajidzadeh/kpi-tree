import { NextResponse } from "next/server";
import { getTree } from "@/db/repo/trees";
import { getSettings } from "@/server/settings";
import { aiStatus } from "@/server/ai/status";
import { budgetExhausted } from "@/server/ai/sessions";
import { getAnalysisQueue } from "@/server/ai/analysisQueue";
import { runAgentQuery } from "@/server/ai/client";
import { createKtiToolServer } from "@/server/ai/tools/server";
import { BASE_SYSTEM } from "@/server/ai/prompts/base";
import {
  DEEP_ANALYSIS_APPENDIX,
  buildDeepAnalysisPrompt,
} from "@/server/ai/prompts/deepAnalysis";
import { publish } from "@/server/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ treeId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { treeId } = await params;
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

  const settings = getSettings();
  publish(treeId, { type: "analysis_status", state: "analyzing" });
  const result = await getAnalysisQueue(treeId).enqueueExclusive(() =>
    runAgentQuery({
      treeId,
      prompt: buildDeepAnalysisPrompt(tree.intakeAnswers.businessModel),
      systemPrompt: BASE_SYSTEM + DEEP_ANALYSIS_APPENDIX,
      model: settings.models.deepAnalysis,
      maxTurns: 16,
      mcpServer: createKtiToolServer(
        { treeId, cancelled: () => false },
        { proposeInsight: true },
      ),
    }),
  );
  publish(treeId, {
    type: "analysis_status",
    state: result.ok ? "idle" : result.kind === "offline" ? "offline" : "idle",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.kind === "offline" ? 503 : result.kind === "budget" ? 409 : 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
