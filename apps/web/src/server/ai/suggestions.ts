import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { lintTree, titleSimilarity } from "@kti/linter";
import type { Suggestion } from "@kti/schema";
import { getDb } from "@/db/client";
import { suggestions } from "@/db/schema";
import { getTree } from "@/db/repo/trees";
import { validateEdgeType } from "@/lib/tree/connect-guards";
import { publish } from "@/server/events";

export interface SuggestionInput {
  title: string;
  formula: string;
  reason: string;
  level: "driver" | "input";
  direction: "increase" | "decrease" | "guard";
  timeliness?: "leading" | "lagging" | undefined;
  parentNodeId: string;
  edgeType: "multiplicative" | "additive" | "influence" | "guard";
}

export function rowToSuggestion(row: typeof suggestions.$inferSelect): Suggestion {
  return {
    ...(JSON.parse(row.payload) as Omit<Suggestion, "id" | "treeId" | "status" | "createdAt">),
    id: row.id,
    treeId: row.treeId,
    status: row.status as Suggestion["status"],
    createdAt: row.createdAt,
  };
}

export function listSuggestions(
  treeId: string,
  status?: Suggestion["status"],
): Suggestion[] {
  const db = getDb();
  const rows = status
    ? db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.treeId, treeId), eq(suggestions.status, status)))
        .all()
    : db.select().from(suggestions).where(eq(suggestions.treeId, treeId)).all();
  return rows.map(rowToSuggestion);
}

export function rejectedTitles(treeId: string): string[] {
  return listSuggestions(treeId, "rejected").map((s) => s.title);
}

/**
 * The FR-4 gate: validate the candidate, simulate the insertion, and run the
 * linter — a suggestion may not introduce a Tier-1 error (or an obvious
 * duplicate). Returns a tool-error message the agent can self-correct from.
 */
export function recordSuggestion(
  treeId: string,
  input: SuggestionInput,
  cancelled: () => boolean,
): { ok: true; suggestion: Suggestion } | { ok: false; error: string } {
  if (cancelled()) {
    return { ok: false, error: "Discarded: the tree changed while you were working." };
  }
  const tree = getTree(treeId);
  if (!tree) return { ok: false, error: "Tree not found." };

  const parent = tree.nodes.find((n) => n.id === input.parentNodeId);
  if (!parent) {
    return {
      ok: false,
      error: `parentNodeId "${input.parentNodeId}" does not exist. Use ids from read_tree.`,
    };
  }

  // Don't re-suggest rejected candidates (FR-4.1), fuzzy-matched by title.
  for (const rejected of rejectedTitles(treeId)) {
    if (titleSimilarity(rejected, input.title) >= 0.85) {
      return {
        ok: false,
        error: `The user already rejected "${rejected}" — do not re-suggest it or close variants.`,
      };
    }
  }
  // Don't suggest a metric that already exists.
  for (const node of tree.nodes) {
    if (titleSimilarity(node.title, input.title) >= 0.85) {
      return {
        ok: false,
        error: `"${input.title}" duplicates the existing metric "${node.title}". Suggest something the tree is actually missing.`,
      };
    }
  }

  const nodesById = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  const edgesById = Object.fromEntries(tree.edges.map((e) => [e.id, e]));
  const typeVerdict = validateEdgeType(
    nodesById,
    edgesById,
    input.parentNodeId,
    "__candidate__",
    input.edgeType,
  );
  if (!typeVerdict.ok) return { ok: false, error: typeVerdict.reason };

  // Simulate the insertion and diff linter findings against baseline.
  const baseline = new Set(
    lintTree({ nodes: tree.nodes, edges: tree.edges }).map((v) => v.fingerprint),
  );
  const simNode = {
    id: "__candidate__",
    title: input.title,
    formula: input.formula,
    reason: input.reason,
    level: input.level,
    direction: input.direction,
    ...(input.timeliness ? { timeliness: input.timeliness } : {}),
    tags: [],
  };
  const simEdge = {
    id: "__candidate_edge__",
    source: input.parentNodeId,
    target: "__candidate__",
    type: input.edgeType,
  };
  const simFindings = lintTree({
    nodes: [...tree.nodes, simNode],
    edges: [...tree.edges, simEdge],
  }).filter((v) => !baseline.has(v.fingerprint));

  const blocking = simFindings.filter(
    (v) => v.severity === "error" || v.ruleId === "DUPLICATE_METRIC",
  );
  if (blocking.length > 0) {
    return {
      ok: false,
      error:
        "Inserting this candidate would violate Tier-1 rules:\n" +
        blocking.map((v) => `- [${v.ruleId}] ${v.message}`).join("\n") +
        "\nRevise the candidate and propose again.",
    };
  }

  const suggestion: Suggestion = {
    id: nanoid(),
    treeId,
    title: input.title,
    formula: input.formula,
    reason: input.reason,
    level: input.level,
    direction: input.direction,
    ...(input.timeliness ? { timeliness: input.timeliness } : {}),
    parentNodeId: input.parentNodeId,
    edgeType: input.edgeType,
    status: "proposed",
    createdAt: Date.now(),
  };
  const { id, treeId: _t, status: _s, createdAt: _c, ...payload } = suggestion;
  getDb()
    .insert(suggestions)
    .values({
      id,
      treeId,
      payload: JSON.stringify(payload),
      status: "proposed",
      createdAt: suggestion.createdAt,
    })
    .run();
  publish(treeId, { type: "suggestion_added", suggestion });
  return { ok: true, suggestion };
}

export function setSuggestionStatus(
  suggestionId: string,
  status: Suggestion["status"],
): Suggestion | null {
  const db = getDb();
  const row = db
    .select()
    .from(suggestions)
    .where(eq(suggestions.id, suggestionId))
    .get();
  if (!row) return null;
  db.update(suggestions)
    .set({ status })
    .where(eq(suggestions.id, suggestionId))
    .run();
  return rowToSuggestion({ ...row, status });
}
