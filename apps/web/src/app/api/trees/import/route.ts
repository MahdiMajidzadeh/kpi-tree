import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { MigrationError, TreeFileSchema, migrateTreeFile } from "@kti/schema";
import { createTree } from "@/db/repo/trees";
import { getDb } from "@/db/client";
import { reconcileRuleInsights } from "@/server/lint-reconcile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  let migrated: unknown;
  try {
    migrated = migrateTreeFile(raw);
  } catch (error) {
    if (error instanceof MigrationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const parsed = TreeFileSchema.safeParse(migrated);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Import failed validation:\n${z.prettifyError(parsed.error)}` },
      { status: 400 },
    );
  }

  // Remap all ids so re-importing the same file never collides.
  const source = parsed.data.tree;
  const idMap = new Map<string, string>();
  const nodes = source.nodes.map((n) => {
    const newId = nanoid();
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });
  const edges = source.edges.map((e) => ({
    ...e,
    id: nanoid(),
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
  }));

  const db = getDb();
  const tree = db.transaction(() => {
    const created = createTree(
      {
        name: source.name,
        productDescription: source.productDescription,
        intakeAnswers: source.intakeAnswers,
        nodes,
        edges,
      },
      db,
    );
    reconcileRuleInsights(created, db); // seed rule insights
    return created;
  });

  return NextResponse.json({ tree }, { status: 201 });
}
