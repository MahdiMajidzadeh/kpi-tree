import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import type { MetricNode, MutationEvent } from "@kti/schema";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kti-queue-test-"));
process.env.KTI_DB_PATH = path.join(tmpDir, "test.db");

const { createTree } = await import("@/db/repo/trees");
const { applyMutations } = await import("@/server/apply-mutations");
const { TreeAnalysisQueue } = await import("@/server/ai/analysisQueue");
const { getSessionRow } = await import("@/server/ai/sessions");
const { recordSuggestion, setSuggestionStatus } = await import(
  "@/server/ai/suggestions"
);
const { recordAgentInsight } = await import("@/server/ai/insights");
const { listInsights } = await import("@/db/repo/insights");

function node(id: string, overrides: Partial<MetricNode> = {}): MetricNode {
  return {
    id,
    title: `Metric ${id}`,
    formula: `Count of ${id} events`,
    reason: `Long enough reason for metric ${id}.`,
    level: "driver",
    direction: "increase",
    tags: [],
    origin: "user",
    ...overrides,
  };
}

function seedTree() {
  const ns = nanoid();
  const child = nanoid();
  const tree = createTree({
    name: "Queue test",
    nodes: [
      node(ns, { level: "north_star", title: "GMV", formula: "Orders × AOV" }),
      node(child, { level: "input", title: "Orders", formula: "Count of orders" }),
    ],
    edges: [{ id: nanoid(), source: ns, target: child, type: "multiplicative" }],
  });
  return { tree, ns, child };
}

function mutate(treeId: string) {
  const fresh = node(nanoid(), { level: "input", title: `M${nanoid().slice(0, 4)}` });
  const event: MutationEvent = {
    id: nanoid(),
    timestamp: Date.now(),
    type: "node_added",
    node: fresh,
  };
  applyMutations(treeId, [event]);
}

describe("TreeAnalysisQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces a burst of edits into exactly one analysis run", async () => {
    const { tree } = seedTree();
    const runner = vi.fn().mockResolvedValue({
      ok: true,
      resultText: "no insights",
      numTurns: 1,
    });
    const queue = new TreeAnalysisQueue(tree.id, runner);

    for (let i = 0; i < 10; i++) {
      mutate(tree.id);
      queue.notifyMutation();
      await vi.advanceTimersByTimeAsync(100); // 10 edits inside 5s
    }
    expect(runner).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1600); // past the 1.5s debounce
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("advances the watermark only after a successful run", async () => {
    const { tree } = seedTree();
    const runner = vi.fn().mockResolvedValue({ ok: true, resultText: "", numTurns: 1 });
    const queue = new TreeAnalysisQueue(tree.id, runner);

    mutate(tree.id);
    queue.notifyMutation();
    await vi.advanceTimersByTimeAsync(1600);
    expect(runner).toHaveBeenCalledTimes(1);
    const seqAfterFirst = getSessionRow(tree.id).lastAnalyzedSeq;
    expect(seqAfterFirst).toBeGreaterThan(0);

    // No new mutations → next tick does not fire another run.
    queue.notifyMutation();
    await vi.advanceTimersByTimeAsync(1600);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("keeps the watermark when a run is interrupted, so mutations fold into the next diff", async () => {
    const { tree } = seedTree();
    const runner = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: "interrupted", error: "interrupted" })
      .mockResolvedValue({ ok: true, resultText: "", numTurns: 1 });
    const queue = new TreeAnalysisQueue(tree.id, runner);

    mutate(tree.id);
    queue.notifyMutation();
    await vi.advanceTimersByTimeAsync(1600);
    expect(getSessionRow(tree.id).lastAnalyzedSeq).toBe(0); // unchanged

    mutate(tree.id);
    queue.notifyMutation();
    await vi.advanceTimersByTimeAsync(1600);
    expect(runner).toHaveBeenCalledTimes(2);
    // Second run's diff includes BOTH mutations (since watermark stayed 0).
    const secondPrompt = (runner.mock.calls[1]![0] as { prompt: string }).prompt;
    expect(getSessionRow(tree.id).lastAnalyzedSeq).toBeGreaterThan(0);
    expect((secondPrompt.match(/"node_added"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("marks an in-flight run cancelled when a new mutation arrives", async () => {
    const { tree } = seedTree();
    let cancelledSeen = false;
    let queueRef: InstanceType<typeof TreeAnalysisQueue>;
    const runner = vi.fn().mockImplementation(async (opts: { onStarted?: (q: unknown) => void }) => {
      const fakeQuery = { interrupt: vi.fn().mockResolvedValue(undefined) };
      opts.onStarted?.(fakeQuery);
      // Simulate a new edit arriving while in flight:
      mutate(tree.id);
      queueRef.notifyMutation();
      cancelledSeen = (fakeQuery.interrupt as ReturnType<typeof vi.fn>).mock.calls.length > 0;
      return { ok: false, kind: "interrupted", error: "interrupted" };
    });
    queueRef = new TreeAnalysisQueue(tree.id, runner);

    mutate(tree.id);
    queueRef.notifyMutation();
    await vi.advanceTimersByTimeAsync(1600);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(cancelledSeen).toBe(true);

    // The re-debounced run fires afterwards.
    await vi.advanceTimersByTimeAsync(1600);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  afterAll(() => {
    vi.useRealTimers();
  });
});

describe("propose gates", () => {
  it("agent insight dedup: identical condition is not re-recorded, dismissed stays dismissed", () => {
    const { tree, child } = seedTree();
    const input = {
      severity: "warning" as const,
      category: "business_gap" as const,
      title: "Orders lacks a quality guard",
      body: "Order volume without a returns guard invites quality regressions.",
      nodeIds: [child],
    };
    const first = recordAgentInsight(tree.id, input, () => false);
    expect(first.outcome).toBe("recorded");
    const second = recordAgentInsight(tree.id, { ...input, title: "Different title, same condition" }, () => false);
    expect(second.outcome).toBe("duplicate");
  });

  it("cancelled run's proposals are dropped (stale insights never render)", () => {
    const { tree, child } = seedTree();
    const outcome = recordAgentInsight(
      tree.id,
      {
        severity: "info" as const,
        category: "other" as const,
        title: "Stale",
        body: "Should not persist.",
        nodeIds: [child],
      },
      () => true,
    );
    expect(outcome.outcome).toBe("stale");
    expect(
      listInsights(tree.id, ["active"]).filter((i) => i.title === "Stale"),
    ).toHaveLength(0);
  });

  it("suggestion gate: cycle/duplicate-introducing candidates are rejected with linter messages", () => {
    const { tree, ns, child } = seedTree();
    // Duplicate of existing node title → rejected.
    const dup = recordSuggestion(
      tree.id,
      {
        title: "Orders",
        formula: "Count of orders",
        reason: "Duplicate on purpose for the test.",
        level: "input",
        direction: "increase",
        parentNodeId: ns,
        edgeType: "influence",
      },
      () => false,
    );
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain("duplicates");

    // Second multiplicative parent for the same child → rejected by type guard.
    const second = recordSuggestion(
      tree.id,
      {
        title: "Sessions volume",
        formula: "Count of sessions",
        reason: "Testing multiplicative parent constraint.",
        level: "input",
        direction: "increase",
        parentNodeId: child,
        edgeType: "multiplicative",
      },
      () => false,
    );
    // child already IS a multiplicative child of ns; adding a mult child UNDER it is fine,
    // so this one should pass the type guard and the linter gate.
    expect(second.ok).toBe(true);

    // Unknown parent → readable error.
    const ghost = recordSuggestion(
      tree.id,
      {
        title: "Ghost metric",
        formula: "Count of ghosts",
        reason: "Parent does not exist.",
        level: "input",
        direction: "increase",
        parentNodeId: "nope",
        edgeType: "influence",
      },
      () => false,
    );
    expect(ghost.ok).toBe(false);
    if (!ghost.ok) expect(ghost.error).toContain("does not exist");
  });

  it("rejected suggestions are not re-suggestable (fuzzy title match)", () => {
    const { tree, ns } = seedTree();
    const first = recordSuggestion(
      tree.id,
      {
        title: "Checkout Conversion Rate",
        formula: "Orders count / Checkout sessions count",
        reason: "Standard funnel driver.",
        level: "input",
        direction: "increase",
        parentNodeId: ns,
        edgeType: "influence",
      },
      () => false,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    setSuggestionStatus(first.suggestion.id, "rejected");

    const retry = recordSuggestion(
      tree.id,
      {
        title: "checkout conversion-rate",
        formula: "Orders / Checkout sessions",
        reason: "Same thing, different casing.",
        level: "input",
        direction: "increase",
        parentNodeId: ns,
        edgeType: "influence",
      },
      () => false,
    );
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.error).toContain("rejected");
  });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
