import { eq } from "drizzle-orm";
import type { Insight, Tree } from "@kti/schema";
import { getDb } from "@/db/client";
import { agentSessions } from "@/db/schema";
import { getSettings } from "@/server/settings";
import { publish } from "@/server/events";

export interface SessionRow {
  treeId: string;
  sessionId: string | null;
  turnCount: number;
  tokensUsed: number;
  costUsd: number;
  lastAnalyzedSeq: number;
}

export function getSessionRow(treeId: string): SessionRow {
  const db = getDb();
  const row = db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.treeId, treeId))
    .get();
  if (row) return row;
  const now = Date.now();
  db.insert(agentSessions)
    .values({ treeId, createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .run();
  return {
    treeId,
    sessionId: null,
    turnCount: 0,
    tokensUsed: 0,
    costUsd: 0,
    lastAnalyzedSeq: 0,
  };
}

/** Resume id for the next query — resets the session first when it has
 *  grown past the configured turn limit (§7.1). */
export function resumeIdFor(treeId: string): string | undefined {
  const row = getSessionRow(treeId);
  const limit = getSettings().sessionTurnLimit;
  if (row.sessionId && row.turnCount >= limit) {
    resetSession(treeId);
    return undefined;
  }
  return row.sessionId ?? undefined;
}

export function storeSessionId(treeId: string, sessionId: string): void {
  const db = getDb();
  db.update(agentSessions)
    .set({ sessionId, updatedAt: Date.now() })
    .where(eq(agentSessions.treeId, treeId))
    .run();
}

export function clearSessionId(treeId: string): void {
  getSessionRow(treeId);
  getDb()
    .update(agentSessions)
    .set({ sessionId: null, updatedAt: Date.now() })
    .where(eq(agentSessions.treeId, treeId))
    .run();
}

/** New session: fresh id, zeroed turn/token meters (cost stays cumulative). */
export function resetSession(treeId: string): void {
  getSessionRow(treeId);
  getDb()
    .update(agentSessions)
    .set({ sessionId: null, turnCount: 0, tokensUsed: 0, updatedAt: Date.now() })
    .where(eq(agentSessions.treeId, treeId))
    .run();
}

export function recordUsage(
  treeId: string,
  usage: { turns: number; tokens: number; costUsd: number },
): void {
  const row = getSessionRow(treeId);
  const db = getDb();
  db.update(agentSessions)
    .set({
      turnCount: row.turnCount + usage.turns,
      tokensUsed: row.tokensUsed + usage.tokens,
      costUsd: row.costUsd + usage.costUsd,
      updatedAt: Date.now(),
    })
    .where(eq(agentSessions.treeId, treeId))
    .run();
  publish(treeId, {
    type: "usage_update",
    tokensUsed: row.tokensUsed + usage.tokens,
    budget: getSettings().sessionTokenBudget,
    costUsd: row.costUsd + usage.costUsd,
  });
}

export function budgetExhausted(treeId: string): boolean {
  return getSessionRow(treeId).tokensUsed >= getSettings().sessionTokenBudget;
}

export function setLastAnalyzedSeq(treeId: string, seq: number): void {
  getSessionRow(treeId);
  getDb()
    .update(agentSessions)
    .set({ lastAnalyzedSeq: seq, updatedAt: Date.now() })
    .where(eq(agentSessions.treeId, treeId))
    .run();
}

/** Compact digest used to re-seed a fresh session after a reset (§7.1). */
export function buildSeedSummary(tree: Tree, activeInsights: Insight[]): string {
  const lines: string[] = [
    `Context: you are re-joining work on the KPI tree "${tree.name}".`,
    `Product: ${tree.productDescription || "(no description)"}`,
    "Current tree:",
  ];
  for (const node of tree.nodes) {
    const extras = [node.level, node.direction, node.timeliness]
      .filter(Boolean)
      .join(", ");
    lines.push(`- [${node.id}] ${node.title} = ${node.formula} (${extras})`);
  }
  lines.push("Edges:");
  for (const edge of tree.edges) {
    lines.push(`- ${edge.source} →(${edge.type}) ${edge.target}`);
  }
  if (activeInsights.length > 0) {
    lines.push("Active insights (do not repeat):");
    for (const insight of activeInsights) {
      lines.push(`- [${insight.severity}] ${insight.title}`);
    }
  }
  return lines.join("\n");
}
