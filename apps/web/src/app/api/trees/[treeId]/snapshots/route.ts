import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/db/client";
import { snapshots } from "@/db/schema";
import { getTree } from "@/db/repo/trees";
import { exportTreeFile } from "@/server/export/tree-file";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { treeId } = await params;
  const rows = getDb()
    .select({
      id: snapshots.id,
      name: snapshots.name,
      createdAt: snapshots.createdAt,
    })
    .from(snapshots)
    .where(eq(snapshots.treeId, treeId))
    .orderBy(desc(snapshots.createdAt))
    .all();
  return NextResponse.json({ snapshots: rows });
}

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

export async function POST(request: Request, { params }: Params) {
  const { treeId } = await params;
  const body = CreateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const tree = getTree(treeId);
  if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const id = nanoid();
  getDb()
    .insert(snapshots)
    .values({
      id,
      treeId,
      name: body.data.name,
      treeFile: JSON.stringify(exportTreeFile(tree)),
      createdAt: Date.now(),
    })
    .run();
  return NextResponse.json(
    { snapshot: { id, name: body.data.name, createdAt: Date.now() } },
    { status: 201 },
  );
}
