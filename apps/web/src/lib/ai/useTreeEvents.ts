"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { Insight, Suggestion } from "@kti/schema";
import type { EditorState } from "@/stores/tree-editor-store";

/** One EventSource per open tree: pushes insights, analysis status, usage,
 *  and suggestions into the store. On every (re)connect the active-insight
 *  snapshot is refetched — simpler and just as correct as replay locally. */
export function useTreeEvents(store: StoreApi<EditorState>): void {
  useEffect(() => {
    const treeId = store.getState().treeId;
    const source = new EventSource(`/api/trees/${treeId}/events`);

    const json = <T,>(event: Event): T => JSON.parse((event as MessageEvent).data) as T;

    source.onopen = () => {
      void (async () => {
        try {
          const response = await fetch(`/api/trees/${treeId}/insights?status=active`);
          if (!response.ok) return;
          const data = (await response.json()) as { insights: Insight[] };
          store.getState().setInsights(data.insights);
        } catch {
          // transient; next reconnect will retry
        }
      })();
    };

    source.addEventListener("insight_added", (event) => {
      store.getState().upsertInsight(json<{ insight: Insight }>(event).insight);
    });
    source.addEventListener("insight_resolved", (event) => {
      store.getState().resolveInsight(json<{ insightId: string }>(event).insightId);
    });
    source.addEventListener("analysis_status", (event) => {
      store
        .getState()
        .setAnalysisState(json<{ state: EditorState["analysisState"] }>(event).state);
    });
    source.addEventListener("usage_update", (event) => {
      const data = json<{ tokensUsed: number; budget: number; costUsd: number }>(event);
      store.getState().setUsage(data);
    });
    source.addEventListener("suggestion_added", (event) => {
      store.getState().upsertSuggestion(json<{ suggestion: Suggestion }>(event).suggestion);
    });

    return () => source.close();
  }, [store]);
}
