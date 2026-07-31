import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Insight, SuggestedFix } from "@kti/schema";
import { getDb } from "@/db/client";
import { insights } from "@/db/schema";
import { insightToRow, rowToInsight } from "@/db/repo/insights";
import { publish } from "@/server/events";

export const AGENT_CATEGORIES = [
  "semantic_consequence",
  "business_gap",
  "formula_quality",
  "duplicate_intent",
  "removal_orphan",
  "counter_metric",
  "benchmark_gap",
  "praise",
  "other",
] as const;
export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

/** Condition identity for agent insights: the category (condition class) +
 *  the nodes it concerns. Titles are too unstable to hash (§9 of the plan). */
export function agentFingerprint(category: string, nodeIds: string[]): string {
  return (
    "agent:" +
    createHash("sha1")
      .update(`${category}:${[...nodeIds].sort().join(",")}`)
      .digest("hex")
  );
}

export interface ProposeInsightInput {
  severity: "warning" | "info" | "praise";
  category: AgentCategory;
  title: string;
  body: string;
  nodeIds: string[];
  edgeIds?: string[];
  suggestedFix?: SuggestedFix;
}

export type ProposeOutcome =
  | { outcome: "recorded"; insight: Insight }
  | { outcome: "duplicate"; message: string }
  | { outcome: "stale" };

/** Validate, fingerprint-dedup, persist, and broadcast one agent insight. */
export function recordAgentInsight(
  treeId: string,
  input: ProposeInsightInput,
  cancelled: () => boolean,
): ProposeOutcome {
  if (cancelled()) return { outcome: "stale" };

  const fingerprint = agentFingerprint(input.category, input.nodeIds);
  const db = getDb();
  const existing = db
    .select({ id: insights.id, status: insights.status })
    .from(insights)
    .where(
      and(
        eq(insights.treeId, treeId),
        eq(insights.fingerprint, fingerprint),
        inArray(insights.status, ["active", "dismissed"]),
      ),
    )
    .get();
  if (existing) {
    return {
      outcome: "duplicate",
      message:
        existing.status === "dismissed"
          ? "An identical insight was dismissed by the user — do not raise it again."
          : "This insight is already active — do not repeat it.",
    };
  }

  const insight: Insight = {
    id: nanoid(),
    treeId,
    source: "agent",
    severity: input.severity,
    title: input.title,
    body: input.body,
    nodeIds: input.nodeIds,
    edgeIds: input.edgeIds ?? [],
    status: "active",
    ...(input.suggestedFix ? { suggestedFix: input.suggestedFix } : {}),
    fingerprint,
    createdAt: Date.now(),
  };
  db.insert(insights).values(insightToRow(insight)).run();
  publish(treeId, { type: "insight_added", insight });
  return { outcome: "recorded", insight };
}

export function activeAndDismissed(treeId: string): {
  active: Insight[];
  dismissed: Insight[];
} {
  const rows = getDb()
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.treeId, treeId),
        inArray(insights.status, ["active", "dismissed"]),
      ),
    )
    .all()
    .map(rowToInsight);
  return {
    active: rows.filter((r) => r.status === "active"),
    dismissed: rows.filter((r) => r.status === "dismissed"),
  };
}
