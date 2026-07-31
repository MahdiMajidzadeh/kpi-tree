import type { Insight, Suggestion } from "@kti/schema";

export type TreeEvent =
  | { type: "insight_added"; insight: Insight }
  | { type: "insight_resolved"; insightId: string }
  | {
      type: "analysis_status";
      state: "idle" | "analyzing" | "cancelled" | "offline" | "budget_exhausted";
    }
  | {
      type: "generation_progress";
      state: "generating" | "validating" | "rendering" | "done" | "failed";
      message?: string;
      tokensSoFar?: number;
    }
  | { type: "suggestion_added"; suggestion: Suggestion }
  | { type: "suggestions_done"; count: number }
  | { type: "usage_update"; tokensUsed: number; budget: number; costUsd: number };

type Subscriber = (event: TreeEvent) => void;

// globalThis-backed so dev HMR keeps live SSE connections working.
const store = globalThis as unknown as {
  __ktiEventBus?: Map<string, Set<Subscriber>>;
};

function channels(): Map<string, Set<Subscriber>> {
  store.__ktiEventBus ??= new Map();
  return store.__ktiEventBus;
}

export function publish(treeId: string, event: TreeEvent): void {
  const subs = channels().get(treeId);
  if (!subs) return;
  for (const sub of subs) {
    try {
      sub(event);
    } catch {
      // Dead controller — cleanup happens on unsubscribe.
    }
  }
}

export function subscribe(treeId: string, subscriber: Subscriber): () => void {
  const map = channels();
  const subs = map.get(treeId) ?? new Set();
  subs.add(subscriber);
  map.set(treeId, subs);
  return () => {
    subs.delete(subscriber);
    if (subs.size === 0) map.delete(treeId);
  };
}
