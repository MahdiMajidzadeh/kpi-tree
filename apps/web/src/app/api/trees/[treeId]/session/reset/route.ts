import { NextResponse } from "next/server";
import { getTree } from "@/db/repo/trees";
import { getSessionRow, resetSession } from "@/server/ai/sessions";
import { publish } from "@/server/events";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

/** Start a fresh AI session for this tree: zero the turn/token meters (cost
 *  stays cumulative) and drop the resume id, so the next query re-seeds via
 *  buildSeedSummary. This is the recovery path when the token budget is
 *  exhausted (§7.1) — the alternative is raising the budget in Settings. */
export async function POST(_request: Request, { params }: Params) {
  const { treeId } = await params;
  if (!getTree(treeId)) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }
  resetSession(treeId);
  const row = getSessionRow(treeId);
  const usage = {
    tokensUsed: row.tokensUsed,
    budget: getSettings().sessionTokenBudget,
    costUsd: row.costUsd,
  };
  publish(treeId, { type: "usage_update", ...usage });
  // Clear a lingering "budget exhausted" badge; the next edit burst re-probes.
  publish(treeId, { type: "analysis_status", state: "idle" });
  return NextResponse.json({ usage });
}
