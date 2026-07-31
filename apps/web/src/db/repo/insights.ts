import { and, eq, inArray } from "drizzle-orm";
import type { Insight, InsightStatus, SuggestedFix } from "@kti/schema";
import { getDb, type DB } from "../client";
import { insights } from "../schema";

export function rowToInsight(row: typeof insights.$inferSelect): Insight {
  return {
    id: row.id,
    treeId: row.treeId,
    source: row.source as Insight["source"],
    ...(row.ruleId ? { ruleId: row.ruleId } : {}),
    severity: row.severity as Insight["severity"],
    title: row.title,
    body: row.body,
    nodeIds: JSON.parse(row.nodeIds) as string[],
    edgeIds: JSON.parse(row.edgeIds) as string[],
    ...(row.triggeringMutation
      ? { triggeringMutation: JSON.parse(row.triggeringMutation) as unknown }
      : {}),
    status: row.status as InsightStatus,
    ...(row.suggestedFix
      ? { suggestedFix: JSON.parse(row.suggestedFix) as SuggestedFix }
      : {}),
    fingerprint: row.fingerprint,
    createdAt: row.createdAt,
    ...(row.resolvedAt !== null ? { resolvedAt: row.resolvedAt } : {}),
  };
}

export function insightToRow(insight: Insight): typeof insights.$inferInsert {
  return {
    id: insight.id,
    treeId: insight.treeId,
    source: insight.source,
    ruleId: insight.ruleId ?? null,
    severity: insight.severity,
    title: insight.title,
    body: insight.body,
    nodeIds: JSON.stringify(insight.nodeIds),
    edgeIds: JSON.stringify(insight.edgeIds),
    triggeringMutation:
      insight.triggeringMutation !== undefined
        ? JSON.stringify(insight.triggeringMutation)
        : null,
    status: insight.status,
    suggestedFix: insight.suggestedFix ? JSON.stringify(insight.suggestedFix) : null,
    fingerprint: insight.fingerprint,
    createdAt: insight.createdAt,
    resolvedAt: insight.resolvedAt ?? null,
  };
}

export function insertInsight(insight: Insight, db: DB = getDb()): void {
  db.insert(insights).values(insightToRow(insight)).run();
}

export function listInsights(
  treeId: string,
  statuses: InsightStatus[] = ["active"],
  db: DB = getDb(),
): Insight[] {
  return db
    .select()
    .from(insights)
    .where(and(eq(insights.treeId, treeId), inArray(insights.status, statuses)))
    .all()
    .map(rowToInsight);
}

export function getInsight(id: string, db: DB = getDb()): Insight | null {
  const row = db.select().from(insights).where(eq(insights.id, id)).get();
  return row ? rowToInsight(row) : null;
}

export function setInsightStatus(
  id: string,
  status: InsightStatus,
  db: DB = getDb(),
): boolean {
  const result = db
    .update(insights)
    .set({
      status,
      resolvedAt: status === "resolved" ? Date.now() : null,
    })
    .where(eq(insights.id, id))
    .run();
  return result.changes > 0;
}
