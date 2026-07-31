import { describe, expect, it } from "vitest";
import type { Edge, MetricNode, MutationEvent } from "@kti/schema";
import { applyEvents, contentFromArrays } from "@/lib/tree/apply-event";
import { invertEvents } from "@/lib/tree/invert-event";
import {
  deleteSubtreeEvents,
  reparentEvents,
  subtreeToDelete,
} from "@/lib/tree/delete-node";
import { validateConnection, validateEdgeType } from "@/lib/tree/connect-guards";

function node(id: string, overrides: Partial<MetricNode> = {}): MetricNode {
  return {
    id,
    title: `Metric ${id}`,
    formula: `Count of ${id}`,
    reason: `Reason for ${id} that is long enough.`,
    level: "driver",
    direction: "increase",
    tags: [],
    origin: "user",
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function edge(id: string, source: string, target: string, type: Edge["type"] = "influence"): Edge {
  return { id, source, target, type };
}

// ns → a → b, ns → c, a → c (c is multi-parent)
function fixture() {
  return contentFromArrays(
    [
      node("ns", { level: "north_star" }),
      node("a"),
      node("b", { level: "input" }),
      node("c", { level: "input" }),
    ],
    [
      edge("e1", "ns", "a"),
      edge("e2", "a", "b"),
      edge("e3", "ns", "c"),
      edge("e4", "a", "c"),
    ],
  );
}

let counter = 0;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
function ev(partial: DistributiveOmit<MutationEvent, "id" | "timestamp">): MutationEvent {
  return { id: `ev${counter++}`, timestamp: 1000 + counter, ...partial } as MutationEvent;
}

describe("apply + invert round-trip", () => {
  it("restores exact state including positions after undo", () => {
    const initial = fixture();
    const events: MutationEvent[] = [
      ev({ type: "node_added", node: node("d", { position: { x: 50, y: 60 } }) }),
      ev({ type: "edge_added", edge: edge("e5", "b", "d") }),
      ev({
        type: "node_modified",
        nodeId: "a",
        before: { title: "Metric a", position: { x: 0, y: 0 } },
        after: { title: "Renamed", position: { x: 100, y: 200 } },
      }),
      ev({ type: "edge_retyped", edgeId: "e2", before: "influence", after: "additive" }),
    ];
    const mutated = applyEvents(initial, events);
    expect(mutated.nodes.d).toBeDefined();
    expect(mutated.nodes.a!.title).toBe("Renamed");
    expect(mutated.nodes.a!.position).toEqual({ x: 100, y: 200 });
    expect(mutated.edges.e2!.type).toBe("additive");

    const restored = applyEvents(mutated, invertEvents(events));
    expect(restored.nodes).toEqual(initial.nodes);
    expect(restored.edges).toEqual(initial.edges);
  });

  it("undo of node_removed restores the node and all its edges", () => {
    const initial = fixture();
    const removeA = ev({
      type: "node_removed",
      node: initial.nodes.a!,
      removedEdges: [initial.edges.e1!, initial.edges.e2!, initial.edges.e4!],
    });
    const mutated = applyEvents(initial, [removeA]);
    expect(mutated.nodes.a).toBeUndefined();
    expect(Object.keys(mutated.edges).sort()).toEqual(["e3"]);

    const restored = applyEvents(mutated, invertEvents([removeA]));
    expect(restored.nodes).toEqual(initial.nodes);
    expect(restored.edges).toEqual(initial.edges);
  });
});

describe("delete strategies", () => {
  it("subtree delete keeps multi-parent descendants that stay reachable", () => {
    // Deleting `a`: b is only reachable via a → deleted; c is also fed by ns → kept.
    expect(subtreeToDelete(fixture(), "a").sort()).toEqual(["a", "b"]);
  });

  it("subtree delete events remove exactly the doomed nodes and edges", () => {
    const content = fixture();
    const after = applyEvents(content, deleteSubtreeEvents(content, "a"));
    expect(Object.keys(after.nodes).sort()).toEqual(["c", "ns"]);
    expect(Object.keys(after.edges).sort()).toEqual(["e3"]);
  });

  it("subtree delete round-trips through undo", () => {
    const content = fixture();
    const events = deleteSubtreeEvents(content, "a");
    const after = applyEvents(content, events);
    const restored = applyEvents(after, invertEvents(events));
    expect(restored.nodes).toEqual(content.nodes);
    expect(restored.edges).toEqual(content.edges);
  });

  it("re-parent rewires children to grandparents preserving edge type", () => {
    const content = contentFromArrays(
      [node("ns", { level: "north_star" }), node("mid"), node("leaf", { level: "input" })],
      [edge("e1", "ns", "mid", "additive"), edge("e2", "mid", "leaf", "multiplicative")],
    );
    const after = applyEvents(content, reparentEvents(content, "mid"));
    expect(after.nodes.mid).toBeUndefined();
    const rewired = Object.values(after.edges);
    expect(rewired).toHaveLength(1);
    expect(rewired[0]!.source).toBe("ns");
    expect(rewired[0]!.target).toBe("leaf");
    expect(rewired[0]!.type).toBe("multiplicative");
  });

  it("re-parent skips duplicate pairs (child already wired to grandparent)", () => {
    const content = fixture(); // ns→a→c and ns→c both exist
    const after = applyEvents(content, reparentEvents(content, "a"));
    // c already had ns as parent; no duplicate ns→c edge.
    const pairs = Object.values(after.edges).map((e) => `${e.source}->${e.target}`);
    expect(pairs.filter((p) => p === "ns->c")).toHaveLength(1);
    // b got re-wired to ns.
    expect(pairs).toContain("ns->b");
  });
});

describe("connect guards", () => {
  it("rejects self-loops, duplicates, and cycles with reasons", () => {
    const { nodes, edges } = fixture();
    expect(validateConnection(nodes, edges, "a", "a").ok).toBe(false);
    expect(validateConnection(nodes, edges, "ns", "a").ok).toBe(false);
    const cycle = validateConnection(nodes, edges, "b", "ns");
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.reason).toContain("cycle");
  });

  it("accepts a valid new connection", () => {
    const { nodes, edges } = fixture();
    expect(validateConnection(nodes, edges, "b", "c").ok).toBe(true);
  });

  it("rejects a second multiplicative parent for the same child", () => {
    const content = contentFromArrays(
      [node("ns", { level: "north_star" }), node("p2"), node("child", { level: "input" })],
      [
        edge("e1", "ns", "child", "multiplicative"),
        edge("e2", "ns", "p2", "influence"),
      ],
    );
    const verdict = validateEdgeType(
      content.nodes,
      content.edges,
      "p2",
      "child",
      "multiplicative",
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("multiplicative");
    // influence is fine
    expect(
      validateEdgeType(content.nodes, content.edges, "p2", "child", "influence").ok,
    ).toBe(true);
  });
});
