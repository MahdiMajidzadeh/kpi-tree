import { NextResponse } from "next/server";
import { z } from "zod";
import { setSuggestionStatus } from "@/server/ai/suggestions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ suggestionId: string }> };

const PatchSchema = z.object({ action: z.enum(["accept", "reject"]) });

export async function PATCH(request: Request, { params }: Params) {
  const { suggestionId } = await params;
  const body = PatchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const status = body.data.action === "accept" ? "accepted" : "rejected";
  const suggestion = setSuggestionStatus(suggestionId, status);
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  return NextResponse.json({ suggestion });
}
