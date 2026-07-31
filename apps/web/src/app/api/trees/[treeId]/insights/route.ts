import { NextResponse } from "next/server";
import type { InsightStatus } from "@kti/schema";
import { listInsights } from "@/db/repo/insights";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { treeId } = await params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "active";
  const statuses = statusParam
    .split(",")
    .filter((s): s is InsightStatus =>
      ["active", "dismissed", "resolved"].includes(s),
    );
  return NextResponse.json({
    insights: listInsights(treeId, statuses.length > 0 ? statuses : ["active"]),
  });
}
