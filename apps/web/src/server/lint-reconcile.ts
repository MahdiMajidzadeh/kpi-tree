import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { lintTree, type Violation } from "@kti/linter";
import type { Insight, Tree } from "@kti/schema";
import type { DB } from "@/db/client";
import { insights } from "@/db/schema";
import { rowToInsight } from "@/db/repo/insights";

export interface ReconcileResult {
  added: Insight[];
  resolved: Insight[];
  violations: Violation[];
}

/**
 * Run the Tier-1 linter and reconcile its stateless output against stored
 * rule insights by fingerprint:
 *  - new fingerprint → insert active insight
 *  - fingerprint still present but dismissed → stays dismissed (FR-3)
 *  - active/dismissed fingerprint gone → resolved (auto-resolve; a future
 *    recurrence counts as a new occurrence and may re-raise)
 */
export function reconcileRuleInsights(
  tree: Tree,
  db: DB,
  triggeringMutation?: unknown,
): ReconcileResult {
  const violations = lintTree({ nodes: tree.nodes, edges: tree.edges });
  const byFingerprint = new Map(violations.map((v) => [v.fingerprint, v]));

  const existing = db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.treeId, tree.id),
        eq(insights.source, "rule"),
        inArray(insights.status, ["active", "dismissed"]),
      ),
    )
    .all()
    .map(rowToInsight);
  const existingFingerprints = new Set(existing.map((i) => i.fingerprint));

  const added: Insight[] = [];
  for (const violation of violations) {
    if (existingFingerprints.has(violation.fingerprint)) continue;
    const insight: Insight = {
      id: nanoid(),
      treeId: tree.id,
      source: "rule",
      ruleId: violation.ruleId,
      severity: violation.severity,
      title: violation.title,
      body: violation.message,
      nodeIds: violation.nodeIds,
      edgeIds: violation.edgeIds,
      ...(triggeringMutation !== undefined ? { triggeringMutation } : {}),
      status: "active",
      fingerprint: violation.fingerprint,
      createdAt: Date.now(),
    };
    db.insert(insights)
      .values({
        id: insight.id,
        treeId: insight.treeId,
        source: "rule",
        ruleId: insight.ruleId,
        severity: insight.severity,
        title: insight.title,
        body: insight.body,
        nodeIds: JSON.stringify(insight.nodeIds),
        edgeIds: JSON.stringify(insight.edgeIds),
        triggeringMutation:
          triggeringMutation !== undefined ? JSON.stringify(triggeringMutation) : null,
        status: "active",
        suggestedFix: null,
        fingerprint: insight.fingerprint,
        createdAt: insight.createdAt,
        resolvedAt: null,
      })
      .run();
    added.push(insight);
    existingFingerprints.add(violation.fingerprint);
  }

  const resolved: Insight[] = [];
  const now = Date.now();
  for (const insight of existing) {
    if (byFingerprint.has(insight.fingerprint)) continue;
    db.update(insights)
      .set({ status: "resolved", resolvedAt: now })
      .where(eq(insights.id, insight.id))
      .run();
    resolved.push({ ...insight, status: "resolved", resolvedAt: now });
  }

  return { added, resolved, violations };
}
