import { and, eq, gt } from "drizzle-orm";
import type { MutationEvent } from "@kti/schema";
import { getDb, type DB } from "../client";
import { mutations } from "../schema";

export function appendMutation(
  treeId: string,
  event: MutationEvent,
  db: DB,
): void {
  db.insert(mutations)
    .values({
      id: event.id,
      treeId,
      type: event.type,
      payload: JSON.stringify(event),
      createdAt: event.timestamp,
    })
    .run();
}

export interface StoredMutation {
  seq: number;
  event: MutationEvent;
}

export function mutationsSince(
  treeId: string,
  sinceSeq: number,
  db: DB = getDb(),
): StoredMutation[] {
  return db
    .select()
    .from(mutations)
    .where(and(eq(mutations.treeId, treeId), gt(mutations.seq, sinceSeq)))
    .orderBy(mutations.seq)
    .all()
    .map((row) => ({
      seq: row.seq,
      event: JSON.parse(row.payload) as MutationEvent,
    }));
}

export function latestSeq(treeId: string, db: DB = getDb()): number {
  const rows = db
    .select({ seq: mutations.seq })
    .from(mutations)
    .where(eq(mutations.treeId, treeId))
    .orderBy(mutations.seq)
    .all();
  return rows.length === 0 ? 0 : rows[rows.length - 1]!.seq;
}
