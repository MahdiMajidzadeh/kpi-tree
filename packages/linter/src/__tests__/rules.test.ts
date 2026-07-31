import { describe, expect, it } from "vitest";
import { lintTree } from "../engine";
import type { RuleId } from "../types";
import { cleanTree, t } from "./fixtures";

function ruleHits(tree: ReturnType<typeof cleanTree>, ruleId: RuleId) {
  return lintTree(tree).filter((v) => v.ruleId === ruleId);
}

describe("clean tree", () => {
  it("produces zero violations", () => {
    expect(lintTree(cleanTree())).toEqual([]);
  });
});

describe("MULTI_NORTH_STAR", () => {
  it("fires with zero north stars", () => {
    const tree = t().node("a", "Orders").build();
    const hits = ruleHits(tree, "MULTI_NORTH_STAR");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toContain("no North Star");
  });

  it("fires with two north stars", () => {
    const tree = t()
      .northStar("a", "GMV")
      .northStar("b", "Revenue")
      .edge("a", "b")
      .build();
    const hits = ruleHits(tree, "MULTI_NORTH_STAR");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds.sort()).toEqual(["a", "b"]);
  });

  it("clears when demoted to one", () => {
    const tree = cleanTree();
    expect(ruleHits(tree, "MULTI_NORTH_STAR")).toHaveLength(0);
  });
});

describe("CYCLE", () => {
  it("fires on a cycle and reports its members", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .node("a", "Orders A", { formula: "x" })
      .node("b", "Orders B", { formula: "y" })
      .edge("ns", "a")
      .edge("a", "b")
      .edge("b", "a")
      .build();
    const hits = ruleHits(tree, "CYCLE");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds.sort()).toEqual(["a", "b"]);
    expect(hits[0]!.edgeIds.length).toBeGreaterThanOrEqual(2);
  });

  it("does not fire on a multi-parent DAG", () => {
    // Traffic feeds both Orders and Ad Revenue — legal.
    const tree = t()
      .northStar("ns", "GMV", { formula: "Orders + Ad Revenue" })
      .node("orders", "Orders", { formula: "Traffic × CVR" })
      .node("ads", "Ad Revenue", { formula: "Traffic × RPM" })
      .leaf("traffic", "Traffic", { formula: "Count of sessions" })
      .edge("ns", "orders", "additive")
      .edge("ns", "ads", "additive")
      .edge("orders", "traffic")
      .edge("ads", "traffic")
      .build();
    expect(ruleHits(tree, "CYCLE")).toHaveLength(0);
  });
});

describe("ORPHAN_NODE", () => {
  it("fires per unreachable node", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .node("a", "Orders")
      .leaf("b", "Stray Metric")
      .edge("ns", "a")
      .build();
    const hits = ruleHits(tree, "ORPHAN_NODE");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toEqual(["b"]);
  });

  it("auto-clears once connected (fingerprint disappears)", () => {
    const before = t()
      .northStar("ns", "GMV")
      .leaf("b", "Sessions")
      .build();
    const beforeFp = ruleHits(before, "ORPHAN_NODE").map((v) => v.fingerprint);
    expect(beforeFp).toHaveLength(1);

    const after = t()
      .northStar("ns", "GMV")
      .leaf("b", "Sessions")
      .edge("ns", "b")
      .build();
    const afterFp = ruleHits(after, "ORPHAN_NODE").map((v) => v.fingerprint);
    expect(afterFp).not.toContain(beforeFp[0]);
    expect(afterFp).toHaveLength(0);
  });
});

describe("VANITY_METRIC", () => {
  it("fires on a driver with no children", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .node("v", "Brand Awareness")
      .edge("ns", "v")
      .build();
    const hits = ruleHits(tree, "VANITY_METRIC");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toEqual(["v"]);
  });

  it("does not fire on leaves or decomposed drivers", () => {
    expect(ruleHits(cleanTree(), "VANITY_METRIC")).toHaveLength(0);
  });

  it("does not fire on a single-node starter tree", () => {
    const tree = t().northStar("ns", "GMV").build();
    expect(ruleHits(tree, "VANITY_METRIC")).toHaveLength(0);
  });
});

describe("MISSING_COUNTER_METRIC", () => {
  it("fires on a growth branch without a guard", () => {
    const tree = t()
      .northStar("ns", "Engagement")
      .node("growth", "Signup Growth", { direction: "increase" })
      .leaf("invites", "Invites Sent")
      .edge("ns", "growth")
      .edge("growth", "invites")
      .build();
    const hits = ruleHits(tree, "MISSING_COUNTER_METRIC");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toEqual(["growth"]);
  });

  it("clears when a guard edge is added to the branch", () => {
    const tree = t()
      .northStar("ns", "Engagement")
      .node("growth", "Signup Growth", { direction: "increase" })
      .leaf("invites", "Invites Sent")
      .leaf("spam", "Spam Rate", { direction: "guard" })
      .edge("ns", "growth")
      .edge("growth", "invites")
      .edge("growth", "spam", "guard")
      .build();
    expect(ruleHits(tree, "MISSING_COUNTER_METRIC")).toHaveLength(0);
  });

  it("fires once per branch, on the topmost matching node", () => {
    const tree = t()
      .northStar("ns", "Engagement")
      .node("growth", "Order Growth", { direction: "increase" })
      .node("volume", "Order Volume", { direction: "increase" })
      .edge("ns", "growth")
      .edge("growth", "volume")
      .build();
    const counterHits = ruleHits(tree, "MISSING_COUNTER_METRIC");
    expect(counterHits).toHaveLength(1);
    expect(counterHits[0]!.nodeIds).toEqual(["growth"]);
  });
});

describe("INVALID_DECOMPOSITION", () => {
  it("fires when multiplicative children are absent from the formula", () => {
    const tree = t()
      .northStar("ns", "GMV", { formula: "total money earned" })
      .leaf("orders", "Orders")
      .leaf("aov", "AOV")
      .edge("ns", "orders", "multiplicative")
      .edge("ns", "aov", "multiplicative")
      .build();
    const hits = ruleHits(tree, "INVALID_DECOMPOSITION");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toContain("ns");
  });

  it("fires on mixed multiplicative + additive children", () => {
    const tree = t()
      .northStar("ns", "GMV", { formula: "Orders × AOV" })
      .leaf("orders", "Orders")
      .leaf("aov", "AOV")
      .edge("ns", "orders", "multiplicative")
      .edge("ns", "aov", "additive")
      .build();
    const hits = ruleHits(tree, "INVALID_DECOMPOSITION");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.message).toContain("mixes");
  });

  it("accepts a coherent decomposition", () => {
    expect(ruleHits(cleanTree(), "INVALID_DECOMPOSITION")).toHaveLength(0);
  });
});

describe("NON_ACTIONABLE_LEAF", () => {
  it("fires on a leaf defined only in composite terms", () => {
    const tree = t()
      .northStar("ns", "GMV", { formula: "Orders × AOV" })
      .leaf("nps", "NPS", { formula: "NPS score index" })
      .edge("ns", "nps")
      .build();
    const hits = ruleHits(tree, "NON_ACTIONABLE_LEAF");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toEqual(["nps"]);
  });

  it("does not fire on countable leaves", () => {
    expect(ruleHits(cleanTree(), "NON_ACTIONABLE_LEAF")).toHaveLength(0);
  });
});

describe("LAGGING_ONLY_BRANCH", () => {
  it("fires on an annotated branch with zero leading metrics", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .node("retention", "Retention", { timeliness: "lagging" })
      .leaf("churn", "Churn Cohort", { timeliness: "lagging" })
      .edge("ns", "retention")
      .edge("retention", "churn")
      .build();
    const hits = ruleHits(tree, "LAGGING_ONLY_BRANCH");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds).toEqual(["retention"]);
  });

  it("stays silent on unannotated branches", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .node("retention", "Retention")
      .leaf("churn", "Churn Cohort")
      .edge("ns", "retention")
      .edge("retention", "churn")
      .build();
    expect(ruleHits(tree, "LAGGING_ONLY_BRANCH")).toHaveLength(0);
  });

  it("clears when a leading metric exists in the branch", () => {
    expect(ruleHits(cleanTree(), "LAGGING_ONLY_BRANCH")).toHaveLength(0);
  });
});

describe("DEPTH_PATHOLOGY", () => {
  it("fires when the tree is deeper than 5 levels", () => {
    const builder = t().northStar("n0", "Level 0");
    for (let i = 1; i <= 6; i++) {
      builder.node(`n${i}`, `Level ${i} metric`).edge(`n${i - 1}`, `n${i}`);
    }
    const tree = builder.build();
    const hits = ruleHits(tree, "DEPTH_PATHOLOGY");
    expect(hits.some((h) => h.message.includes("levels deep"))).toBe(true);
  });

  it("fires when a node has more than 7 children", () => {
    const builder = t().northStar("ns", "GMV");
    for (let i = 0; i < 8; i++) {
      builder.leaf(`c${i}`, `Child metric ${i}`).edge("ns", `c${i}`);
    }
    const hits = ruleHits(builder.build(), "DEPTH_PATHOLOGY");
    expect(hits.some((h) => h.message.includes("direct children"))).toBe(true);
  });
});

describe("MISSING_REASON", () => {
  it("fires on empty and placeholder reasons", () => {
    const tree = t()
      .northStar("ns", "GMV", { reason: "" })
      .leaf("a", "Orders", { reason: "TBD" })
      .leaf("b", "AOV", { reason: "Average order value shows basket size health." })
      .edge("ns", "a")
      .edge("ns", "b")
      .build();
    const hits = ruleHits(tree, "MISSING_REASON");
    expect(hits.map((h) => h.nodeIds[0]).sort()).toEqual(["a", "ns"]);
  });
});

describe("DUPLICATE_METRIC", () => {
  it("fires on near-identical English titles", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .leaf("a", "Checkout Conversion Rate")
      .leaf("b", "Checkout conversion-rate")
      .edge("ns", "a")
      .edge("ns", "b")
      .build();
    const hits = ruleHits(tree, "DUPLICATE_METRIC");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.nodeIds.sort()).toEqual(["a", "b"]);
  });

  it("fires on Persian near-duplicates (ZWNJ / variant letters)", () => {
    const tree = t()
      .northStar("ns", "GMV")
      .leaf("a", "نرخ تبدیل چک‌اوت") // with ZWNJ
      .leaf("b", "نرخ تبديل چکاوت") // Arabic yeh variant, no ZWNJ
      .edge("ns", "a")
      .edge("ns", "b")
      .build();
    const hits = ruleHits(tree, "DUPLICATE_METRIC");
    expect(hits).toHaveLength(1);
  });

  it("does not fire on distinct metrics", () => {
    expect(ruleHits(cleanTree(), "DUPLICATE_METRIC")).toHaveLength(0);
  });
});
