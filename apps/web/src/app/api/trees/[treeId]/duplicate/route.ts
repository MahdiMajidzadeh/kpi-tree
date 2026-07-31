import { NextResponse } from "next/server";
import { duplicateTree } from "@/db/repo/trees";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { treeId } = await params;
  const copy = duplicateTree(treeId);
  if (!copy) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  return NextResponse.json({ tree: copy }, { status: 201 });
}
