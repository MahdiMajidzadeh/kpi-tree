import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import type { MetricNode, MutationEvent } from "@kti/schema";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kti-test-"));
process.env.KTI_DB_PATH = path.join(tmpDir, "test.db");

// Imports after env var so the DB lands in the temp dir.
const { createTree, getTree, duplicateTree, deleteTree } = await import(
  "@/db/repo/trees"
);
const { applyMutations } = await import("@/server/apply-mutations");
const { listInsights, setInsightStatus } = await import("@/db/repo/insights");
const { mutationsSince } = await import("@/db/repo/mutations");
const { exportMarkdown } = await import("@/server/export/markdown");
const { exportTreeFile } = await import("@/server/export/tree-file");
const { TreeFileSchema, migrateTreeFile } = await import("@kti/schema");

function node(id: string, overrides: Partial<MetricNode> = {}): MetricNode {
  return {
    id,
    title: `Metric ${id}`,
    formula: `Count of ${id} events`,
    reason: `Because ${id} captures something we must not lose sight of.`,
    level: "driver",
    direction: "increase",
    tags: [],
    origin: "user",
    ...overrides,
  };
}

function ev<T extends MutationEvent["type"]>(
  type: T,
  payload: Omit<Extract<MutationEvent, { type: T }>, "id" | "timestamp" | "type">,
): MutationEvent {
  return {
    id: nanoid(),
    timestamp: Date.now(),
    type,
    ...payload,
  } as unknown as MutationEvent;
}

function seedTree() {
  // Node/edge ids are global PKs — every seed needs fresh ones.
  const ns = nanoid();
  const orders = nanoid();
  const sessions = nanoid();
  const tree = createTree({
    name: "Marketplace",
    nodes: [
      node(ns, { level: "north_star", title: "GMV", formula: "Orders × AOV" }),
      node(orders, { title: "Orders", formula: "Sessions × CVR" }),
      node(sessions, {
        level: "input",
        title: "Sessions",
        formula: "Count of sessions",
      }),
    ],
    edges: [
      { id: nanoid(), source: ns, target: orders, type: "multiplicative" },
      { id: nanoid(), source: orders, target: sessions, type: "influence" },
    ],
  });
  return Object.assign(tree, { ids: { ns, orders, sessions } });
}

describe("persistence + mutation pipeline", () => {
  it("applies a mutation batch and returns the updated tree", () => {
    const tree = seedTree();
    const newNode = node(nanoid(), { title: "AOV", level: "input", formula: "GMV / Orders count" });
    const result = applyMutations(tree.id, [
      ev("node_added", { node: newNode }),
      ev("edge_added", {
        edge: { id: nanoid(), source: tree.ids.ns, target: newNode.id, type: "multiplicative" },
      }),
    ]);
    expect(result).not.toBeNull();
    expect(result!.tree.nodes).toHaveLength(4);

    const reloaded = getTree(tree.id)!;
    expect(reloaded.nodes.map((n) => n.title).sort()).toContain("AOV");
    expect(reloaded.edges).toHaveLength(3);
  });

  it("logs every mutation append-only with increasing seq", () => {
    const tree = seedTree();
    applyMutations(tree.id, [ev("node_added", { node: node(nanoid()) })]);
    applyMutations(tree.id, [
      ev("node_added", { node: node(nanoid(), { level: "input" }) }),
    ]);
    const stored = mutationsSince(tree.id, 0);
    expect(stored.length).toBe(2);
    expect(stored[1]!.seq).toBeGreaterThan(stored[0]!.seq);
  });

  it("creates rule insights on violation and auto-resolves when fixed", () => {
    const tree = seedTree();
    const stray = node(nanoid(), { title: "Stray Metric", level: "input" });
    applyMutations(tree.id, [ev("node_added", { node: stray })]);

    let active = listInsights(tree.id, ["active"]);
    const orphan = active.find((i) => i.ruleId === "ORPHAN_NODE");
    expect(orphan).toBeDefined();
    expect(orphan!.nodeIds).toEqual([stray.id]);

    // Fix it: connect the stray node.
    applyMutations(tree.id, [
      ev("edge_added", {
        edge: { id: nanoid(), source: tree.ids.ns, target: stray.id, type: "influence" },
      }),
    ]);
    active = listInsights(tree.id, ["active"]);
    expect(active.find((i) => i.ruleId === "ORPHAN_NODE")).toBeUndefined();
    const resolved = listInsights(tree.id, ["resolved"]);
    expect(resolved.find((i) => i.ruleId === "ORPHAN_NODE")).toBeDefined();
  });

  it("keeps dismissed insights dismissed while the condition persists", () => {
    const tree = seedTree();
    const stray = node(nanoid(), { title: "Another Stray", level: "input" });
    applyMutations(tree.id, [ev("node_added", { node: stray })]);

    const orphan = listInsights(tree.id, ["active"]).find(
      (i) => i.ruleId === "ORPHAN_NODE" && i.nodeIds[0] === stray.id,
    )!;
    setInsightStatus(orphan.id, "dismissed");

    // Another unrelated mutation re-lints; the dismissed insight must not re-add.
    applyMutations(tree.id, [
      ev("node_modified", {
        nodeId: tree.ids.orders,
        before: { reason: "old" },
        after: { reason: "Orders is the volume engine of the marketplace." },
      }),
    ]);
    const activeOrphans = listInsights(tree.id, ["active"]).filter(
      (i) => i.ruleId === "ORPHAN_NODE" && i.nodeIds[0] === stray.id,
    );
    expect(activeOrphans).toHaveLength(0);
    const dismissed = listInsights(tree.id, ["dismissed"]);
    expect(dismissed.find((i) => i.id === orphan.id)).toBeDefined();
  });

  it("survives node_removed with edge restoration payloads", () => {
    const tree = seedTree();
    const before = getTree(tree.id)!;
    const orders = before.nodes.find((n) => n.title === "Orders")!;
    const incident = before.edges.filter(
      (e) => e.source === orders.id || e.target === orders.id,
    );
    applyMutations(tree.id, [
      ev("node_removed", { node: orders, removedEdges: incident }),
    ]);
    const after = getTree(tree.id)!;
    expect(after.nodes.find((n) => n.id === orders.id)).toBeUndefined();
    expect(after.edges).toHaveLength(0);
  });

  it("duplicate is fully independent", () => {
    const tree = seedTree();
    const copy = duplicateTree(tree.id)!;
    expect(copy.id).not.toBe(tree.id);
    expect(copy.nodes).toHaveLength(3);
    // Mutating the copy leaves the original untouched.
    applyMutations(copy.id, [ev("node_added", { node: node(nanoid()) })]);
    expect(getTree(tree.id)!.nodes).toHaveLength(3);
    expect(getTree(copy.id)!.nodes).toHaveLength(4);
  });

  it("export → import round-trips through the TreeFile schema", () => {
    const tree = getTree(seedTree().id)!;
    const file = exportTreeFile(tree);
    const reparsed = TreeFileSchema.parse(migrateTreeFile(JSON.parse(JSON.stringify(file))));
    expect(reparsed.tree.nodes).toHaveLength(tree.nodes.length);
    expect(reparsed.tree.edges).toHaveLength(tree.edges.length);
  });

  it("markdown export renders hierarchy with formulas and reasons", () => {
    const tree = getTree(seedTree().id)!;
    const md = exportMarkdown(tree);
    expect(md).toContain("**GMV** ⭐");
    expect(md).toContain("`Orders × AOV`");
    expect(md).toContain("(×)");
    expect(md).toContain("*Why:*");
  });

  it("delete removes the tree and cascades", () => {
    const tree = seedTree();
    expect(deleteTree(tree.id)).toBe(true);
    expect(getTree(tree.id)).toBeNull();
  });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
