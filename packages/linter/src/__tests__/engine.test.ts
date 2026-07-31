import { describe, expect, it } from "vitest";
import { lintTree } from "../engine";
import { fingerprint } from "../fingerprint";
import type { LinterEdge, LinterNode } from "../types";
import { t } from "./fixtures";

describe("fingerprints", () => {
  it("are stable regardless of id order", () => {
    expect(fingerprint("R", ["b", "a"], ["e2", "e1"])).toBe(
      fingerprint("R", ["a", "b"], ["e1", "e2"]),
    );
  });

  it("identify the same condition across runs", () => {
    const build = () =>
      t().northStar("ns", "GMV").leaf("x", "Stray").build();
    const [a] = lintTree(build()).filter((v) => v.ruleId === "ORPHAN_NODE");
    const [b] = lintTree(build()).filter((v) => v.ruleId === "ORPHAN_NODE");
    expect(a!.fingerprint).toBe(b!.fingerprint);
  });
});

describe("performance", () => {
  it("lints a 150-node / 300-edge tree in under 50ms", () => {
    const nodes: LinterNode[] = [];
    const edges: LinterEdge[] = [];
    nodes.push({
      id: "ns",
      title: "North Star Metric",
      formula: "Sum of branch metrics",
      reason: "The single metric the whole tree serves.",
      level: "north_star",
      direction: "increase",
    });
    for (let i = 0; i < 149; i++) {
      nodes.push({
        id: `n${i}`,
        title: `Metric number ${i} with a reasonably long title`,
        formula: `Count of events for metric ${i}`,
        reason: `Metric ${i} captures a distinct part of the funnel we care about.`,
        level: i < 40 ? "driver" : "input",
        direction: i % 11 === 0 ? "guard" : "increase",
        timeliness: i % 2 === 0 ? "leading" : "lagging",
      });
      // Layered DAG: connect to a previous node (or NS), plus extra cross edges.
      const parent = i < 5 ? "ns" : `n${Math.floor(i / 5) - 1}`;
      edges.push({
        id: `e${i}`,
        source: parent,
        target: `n${i}`,
        type: i % 3 === 0 ? "multiplicative" : i % 3 === 1 ? "additive" : "influence",
      });
    }
    for (let i = 0; i < 151; i++) {
      const from = `n${i % 30}`;
      const to = `n${40 + ((i * 7) % 100)}`;
      edges.push({ id: `x${i}`, source: from, target: to, type: "influence" });
    }

    const tree = { nodes, edges };
    lintTree(tree); // warm up
    const start = performance.now();
    lintTree(tree);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
