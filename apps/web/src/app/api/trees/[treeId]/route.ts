import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteTree, getTree, renameTree } from "@/db/repo/trees";
import { listInsights } from "@/db/repo/insights";
import { latestSeq } from "@/db/repo/mutations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { treeId } = await params;
  const tree = getTree(treeId);
  if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  return NextResponse.json({
    tree,
    insights: listInsights(treeId, ["active"]),
    latestSeq: latestSeq(treeId),
  });
}

const PatchSchema = z.object({ name: z.string().min(1).max(200) });

export async function PATCH(request: Request, { params }: Params) {
  const { treeId } = await params;
  const body = PatchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  if (!renameTree(treeId, body.data.name)) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { treeId } = await params;
  if (!deleteTree(treeId)) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
