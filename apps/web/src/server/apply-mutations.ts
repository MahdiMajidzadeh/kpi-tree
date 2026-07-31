import { and, eq } from "drizzle-orm";
import type { MutationEvent, Tree } from "@kti/schema";
import { getDb } from "@/db/client";
import { insights } from "@/db/schema";
import { appendMutation, latestSeq } from "@/db/repo/mutations";
import { rowToInsight } from "@/db/repo/insights";
import { getTree, replaceTreeContent } from "@/db/repo/trees";
import { applyEvents, contentFromArrays } from "@/lib/tree/apply-event";
import { reconcileRuleInsights, type ReconcileResult } from "./lint-reconcile";

export interface ApplyMutationsResult extends ReconcileResult {
  tree: Tree;
  latestSeq: number;
}

/**
 * The autosave choke point (FR-5.1 + FR-2.6). In ONE transaction:
 * append events to the log, apply them via the same pure reducer the client
 * uses, replace tree rows, lint, and reconcile rule insights. Agent insights
 * referencing deleted nodes are swept to resolved.
 */
export function applyMutations(
  treeId: string,
  events: MutationEvent[],
): ApplyMutationsResult | null {
  const db = getDb();
  return db.transaction(() => {
    const tree = getTree(treeId, db);
    if (!tree) return null;

    for (const event of events) appendMutation(treeId, event, db);

    const content = applyEvents(
      contentFromArrays(tree.nodes, tree.edges),
      events,
    );
    const nodes = Object.values(content.nodes);
    const edges = Object.values(content.edges);
    replaceTreeContent(treeId, { nodes, edges }, db);

    const updated: Tree = { ...tree, nodes, edges, updatedAt: Date.now() };
    const reconcile = reconcileRuleInsights(
      updated,
      db,
      events[events.length - 1],
    );

    sweepAgentInsights(treeId, new Set(nodes.map((n) => n.id)), reconcile, db);

    return { tree: updated, latestSeq: latestSeq(treeId, db), ...reconcile };
  });
}

/** Agent insights don't auto-resolve by re-lint; but if a node they point at
 *  is gone, the insight no longer maps to the canvas — resolve it. */
function sweepAgentInsights(
  treeId: string,
  liveNodeIds: Set<string>,
  reconcile: ReconcileResult,
  db: ReturnType<typeof getDb>,
): void {
  const rows = db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.treeId, treeId),
        eq(insights.source, "agent"),
        eq(insights.status, "active"),
      ),
    )
    .all();
  const now = Date.now();
  for (const row of rows) {
    const nodeIds = JSON.parse(row.nodeIds) as string[];
    if (nodeIds.length > 0 && nodeIds.some((id) => !liveNodeIds.has(id))) {
      db.update(insights)
        .set({ status: "resolved", resolvedAt: now })
        .where(eq(insights.id, row.id))
        .run();
      reconcile.resolved.push(rowToInsight({ ...row, status: "resolved", resolvedAt: now }));
    }
  }
}
