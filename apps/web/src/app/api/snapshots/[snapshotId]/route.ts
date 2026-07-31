import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { snapshots } from "@/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ snapshotId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { snapshotId } = await params;
  const row = getDb()
    .select()
    .from(snapshots)
    .where(eq(snapshots.id, snapshotId))
    .get();
  if (!row) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  return NextResponse.json({
    snapshot: {
      id: row.id,
      treeId: row.treeId,
      name: row.name,
      createdAt: row.createdAt,
      treeFile: JSON.parse(row.treeFile) as unknown,
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { snapshotId } = await params;
  const result = getDb().delete(snapshots).where(eq(snapshots.id, snapshotId)).run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
