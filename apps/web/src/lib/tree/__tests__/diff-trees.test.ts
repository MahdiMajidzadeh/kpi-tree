import { describe, expect, it } from "vitest";
import type { Edge, MetricNode } from "@kti/schema";
import { diffTrees } from "../diff-trees";

function node(id: string, overrides: Partial<MetricNode> = {}): MetricNode {
  return {
    id,
    title: `Metric ${id}`,
    formula: `Count of ${id}`,
    reason: `Reason for ${id} long enough.`,
    level: "driver",
    direction: "increase",
    tags: [],
    origin: "user",
    position: { x: 1, y: 2 },
    ...overrides,
  };
}

function edge(id: string, source: string, target: string, type: Edge["type"] = "influence"): Edge {
  return { id, source, target, type };
}

describe("diffTrees", () => {
  it("detects adds, removes, field changes, and edge retypes — ignoring positions", () => {
    const before = {
      nodes: [node("ns", { level: "north_star" }), node("a"), node("gone")],
      edges: [edge("e1", "ns", "a"), edge("e2", "ns", "gone")],
    };
    const after = {
      nodes: [
        node("ns", { level: "north_star", position: { x: 999, y: 999 } }), // moved only
        node("a", { title: "Renamed metric", formula: "New formula" }),
        node("fresh", { level: "input" }),
      ],
      edges: [
        edge("e1-new", "ns", "a", "multiplicative"), // same pair, new id + type
        edge("e3", "a", "fresh"),
      ],
    };

    const diff = diffTrees(before, after);
    expect(diff.addedNodes.map((n) => n.id)).toEqual(["fresh"]);
    expect(diff.removedNodes.map((n) => n.id)).toEqual(["gone"]);
    expect(diff.changedNodes).toHaveLength(1);
    expect(diff.changedNodes[0]!.fields.sort()).toEqual(["formula", "title"]);
    // ns only moved → not counted as changed
    expect(diff.changedNodes.some((c) => c.after.id === "ns")).toBe(false);

    expect(diff.addedEdges.map((e) => `${e.source}→${e.target}`)).toEqual(["a→fresh"]);
    expect(diff.removedEdges.map((e) => `${e.source}→${e.target}`)).toEqual(["ns→gone"]);
    expect(diff.retypedEdges).toHaveLength(1);
    expect(diff.retypedEdges[0]!.after.type).toBe("multiplicative");
  });

  it("returns an empty diff for identical trees", () => {
    const state = {
      nodes: [node("ns", { level: "north_star" }), node("a")],
      edges: [edge("e1", "ns", "a")],
    };
    const diff = diffTrees(state, state);
    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
    expect(diff.addedEdges).toHaveLength(0);
    expect(diff.removedEdges).toHaveLength(0);
    expect(diff.retypedEdges).toHaveLength(0);
  });
});
