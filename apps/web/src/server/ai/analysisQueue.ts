import { lintTree } from "@kti/linter";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { getTree } from "@/db/repo/trees";
import { latestSeq, mutationsSince } from "@/db/repo/mutations";
import { publish } from "@/server/events";
import { getSettings } from "@/server/settings";
import { runAgentQuery, type AgentTaskOptions, type AgentTaskResult } from "./client";
import { aiStatus } from "./status";
import { budgetExhausted, getSessionRow, setLastAnalyzedSeq } from "./sessions";
import { activeAndDismissed } from "./insights";
import { createKtiToolServer } from "./tools/server";
import { BASE_SYSTEM } from "./prompts/base";
import { ANALYZE_DIFF_APPENDIX, buildDiffPrompt } from "./prompts/analyzeDiff";

type Runner = (opts: AgentTaskOptions) => Promise<AgentTaskResult>;

/**
 * Per-tree analysis queue (FR-3.2): 1.5s debounce, cancellation of in-flight
 * analysis when new mutations arrive, diff-based prompts, watermark advanced
 * only on successful completion. Lives on globalThis so dev HMR keeps timers
 * and in-flight handles alive.
 */
export class TreeAnalysisQueue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: { q: Query | null; cancelled: boolean } | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly treeId: string,
    private readonly runner: Runner = runAgentQuery,
  ) {}

  /** Called by the mutations route after Tier-1 lint + persist. */
  notifyMutation(): void {
    const settings = getSettings();
    if (!settings.realtimeEnabled) return;
    if (aiStatus().status !== "ready") return; // §7.4: queue NOTHING while offline
    if (budgetExhausted(this.treeId)) {
      publish(this.treeId, { type: "analysis_status", state: "budget_exhausted" });
      return;
    }

    if (this.inFlight && !this.inFlight.cancelled) {
      // Newer edit wins: interrupt and re-debounce (stale insights never render).
      this.inFlight.cancelled = true;
      void this.inFlight.q?.interrupt().catch(() => {});
      publish(this.treeId, { type: "analysis_status", state: "cancelled" });
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enqueueExclusive(() => this.fire());
    }, settings.debounceMs);
  }

  /** Serializes ALL session-resuming tasks for this tree (analysis,
   *  suggestions, deep analysis) — never two concurrent resumes (§7.1). */
  enqueueExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async fire(): Promise<void> {
    const tree = getTree(this.treeId);
    if (!tree) return;

    const targetSeq = latestSeq(this.treeId);
    const sinceSeq = getSessionRow(this.treeId).lastAnalyzedSeq;
    const recent = mutationsSince(this.treeId, sinceSeq);
    if (recent.length === 0) return;

    const flight = { q: null as Query | null, cancelled: false };
    this.inFlight = flight;
    publish(this.treeId, { type: "analysis_status", state: "analyzing" });

    const { active, dismissed } = activeAndDismissed(this.treeId);
    const settings = getSettings();
    const result = await this.runner({
      treeId: this.treeId,
      prompt: buildDiffPrompt({
        tree,
        mutations: recent,
        lintFindings: lintTree({ nodes: tree.nodes, edges: tree.edges }),
        activeInsights: active,
        dismissedInsights: dismissed,
      }),
      systemPrompt: BASE_SYSTEM + ANALYZE_DIFF_APPENDIX,
      model: settings.models.realtime,
      maxTurns: 6,
      mcpServer: createKtiToolServer(
        { treeId: this.treeId, cancelled: () => flight.cancelled },
        { proposeInsight: true },
      ),
      onStarted: (q) => {
        flight.q = q;
        if (flight.cancelled) void q.interrupt().catch(() => {});
      },
    });

    if (this.inFlight === flight) this.inFlight = null;

    if (flight.cancelled || (!result.ok && result.kind === "interrupted")) {
      // Watermark untouched: these mutations fold into the next run's diff.
      return;
    }
    if (result.ok) {
      setLastAnalyzedSeq(this.treeId, targetSeq);
      publish(this.treeId, { type: "analysis_status", state: "idle" });
      return;
    }
    if (result.kind === "offline") {
      publish(this.treeId, { type: "analysis_status", state: "offline" });
    } else if (result.kind === "budget") {
      publish(this.treeId, { type: "analysis_status", state: "budget_exhausted" });
    } else {
      console.error(`analysis failed for tree ${this.treeId}:`, result.error);
      publish(this.treeId, { type: "analysis_status", state: "idle" });
    }
  }
}

const store = globalThis as unknown as {
  __ktiAnalysisQueues?: Map<string, TreeAnalysisQueue>;
};

export function getAnalysisQueue(treeId: string): TreeAnalysisQueue {
  store.__ktiAnalysisQueues ??= new Map();
  let queue = store.__ktiAnalysisQueues.get(treeId);
  if (!queue) {
    queue = new TreeAnalysisQueue(treeId);
    store.__ktiAnalysisQueues.set(treeId, queue);
  }
  return queue;
}
