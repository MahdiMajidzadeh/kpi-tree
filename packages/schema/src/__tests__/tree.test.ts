import { describe, expect, it } from "vitest";
import {
  MutationEventSchema,
  NodeSchema,
  SCHEMA_VERSION,
  TreeFileSchema,
  TreeSchema,
  migrateTreeFile,
  validateTreeStructure,
} from "../index";

function makeNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Metric ${id}`,
    formula: `Count of ${id}`,
    reason: `Because ${id} matters to the product's health.`,
    level: "driver",
    direction: "increase",
    origin: "user",
    ...overrides,
  };
}

function makeTree(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Test tree",
    productDescription: "A marketplace for testing.",
    intakeAnswers: {},
    nodes: [
      makeNode("ns", { level: "north_star" }),
      makeNode("a"),
      makeNode("b", { level: "input" }),
    ],
    edges: [
      { id: "e1", source: "ns", target: "a", type: "multiplicative" },
      { id: "e2", source: "a", target: "b", type: "influence" },
    ],
    createdAt: 1000,
    updatedAt: 1000,
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}

describe("NodeSchema", () => {
  it("accepts Persian titles", () => {
    const parsed = NodeSchema.parse(makeNode("x", { title: "نرخ تبدیل چک‌اوت" }));
    expect(parsed.title).toBe("نرخ تبدیل چک‌اوت");
    expect(parsed.tags).toEqual([]);
  });

  it("rejects empty formula", () => {
    expect(() => NodeSchema.parse(makeNode("x", { formula: "" }))).toThrow();
  });
});

describe("TreeSchema structural refinements", () => {
  it("accepts a valid multi-parent DAG", () => {
    const tree = makeTree({
      nodes: [
        makeNode("ns", { level: "north_star" }),
        makeNode("orders"),
        makeNode("ads"),
        makeNode("traffic", { level: "input" }),
      ],
      edges: [
        { id: "e1", source: "ns", target: "orders", type: "additive" },
        { id: "e2", source: "ns", target: "ads", type: "additive" },
        { id: "e3", source: "orders", target: "traffic", type: "influence" },
        { id: "e4", source: "ads", target: "traffic", type: "influence" },
      ],
    });
    expect(() => TreeSchema.parse(tree)).not.toThrow();
  });

  it("rejects a second north star", () => {
    const tree = makeTree({
      nodes: [
        makeNode("ns", { level: "north_star" }),
        makeNode("ns2", { level: "north_star" }),
      ],
      edges: [{ id: "e1", source: "ns", target: "ns2", type: "influence" }],
    });
    expect(() => TreeSchema.parse(tree)).toThrow(/north_star/);
  });

  it("rejects cycles", () => {
    const tree = makeTree({
      edges: [
        { id: "e1", source: "ns", target: "a", type: "influence" },
        { id: "e2", source: "a", target: "b", type: "influence" },
        { id: "e3", source: "b", target: "a", type: "influence" },
      ],
    });
    expect(() => TreeSchema.parse(tree)).toThrow(/cycle/i);
  });

  it("rejects self-loops and dangling edges", () => {
    expect(
      validateTreeStructure(
        [{ id: "ns", level: "north_star", title: "NS" }],
        [{ id: "e1", source: "ns", target: "ns" }],
      ).join(" "),
    ).toMatch(/self-loop/);
    expect(
      validateTreeStructure(
        [{ id: "ns", level: "north_star", title: "NS" }],
        [{ id: "e1", source: "ns", target: "ghost" }],
      ).join(" "),
    ).toMatch(/missing/);
  });
});

describe("TreeFile + migration", () => {
  it("round-trips a valid tree", () => {
    const file = { schemaVersion: SCHEMA_VERSION, tree: makeTree() };
    const parsed = TreeFileSchema.parse(migrateTreeFile(file));
    expect(parsed.tree.id).toBe("t1");
  });

  it("rejects a future schema version with a readable error", () => {
    expect(() =>
      migrateTreeFile({ schemaVersion: SCHEMA_VERSION + 1, tree: makeTree() }),
    ).toThrow(/only supports up to/);
  });

  it("rejects non-export JSON", () => {
    expect(() => migrateTreeFile({ hello: "world" })).toThrow(/schemaVersion/);
  });
});

describe("MutationEventSchema", () => {
  it("parses all six event types", () => {
    const node = NodeSchema.parse(makeNode("x"));
    const edge = { id: "e9", source: "ns", target: "a", type: "guard" as const };
    const events = [
      { id: "m1", timestamp: 1, type: "node_added", node },
      { id: "m2", timestamp: 2, type: "node_removed", node, removedEdges: [edge] },
      {
        id: "m3",
        timestamp: 3,
        type: "node_modified",
        nodeId: "x",
        before: { title: "Old" },
        after: { title: "New" },
      },
      { id: "m4", timestamp: 4, type: "edge_added", edge },
      { id: "m5", timestamp: 5, type: "edge_removed", edge },
      {
        id: "m6",
        timestamp: 6,
        type: "edge_retyped",
        edgeId: "e9",
        before: "guard",
        after: "influence",
      },
    ];
    for (const e of events) {
      expect(() => MutationEventSchema.parse(e)).not.toThrow();
    }
  });
});
