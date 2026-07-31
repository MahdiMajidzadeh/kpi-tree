import { NextResponse } from "next/server";
import { z } from "zod";
import { getInsight, setInsightStatus } from "@/db/repo/insights";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ insightId: string }> };

const PatchSchema = z.object({
  action: z.enum(["dismiss", "reactivate", "resolve"]),
});

export async function PATCH(request: Request, { params }: Params) {
  const { insightId } = await params;
  const body = PatchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const insight = getInsight(insightId);
  if (!insight) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }
  const status =
    body.data.action === "dismiss"
      ? "dismissed"
      : body.data.action === "resolve"
        ? "resolved"
        : "active";
  setInsightStatus(insightId, status);
  return NextResponse.json({ ok: true, status });
}
