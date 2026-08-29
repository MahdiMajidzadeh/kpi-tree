"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { StoreApi } from "zustand/vanilla";
import type { Insight, Severity } from "@kti/schema";
import { SEVERITY_RING } from "@/lib/colors";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { SuggestionCard } from "@/components/panels/SuggestionCard";
import { ChatPanel } from "@/components/panels/ChatPanel";

const SEVERITY_LABEL: Record<Severity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
  praise: "Praise",
};

const SEVERITY_ORDER: Severity[] = ["error", "warning", "info", "praise"];

function InsightCard({
  insight,
  store,
}: {
  insight: Insight;
  store: StoreApi<EditorState>;
}) {
  return (
    <div
      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 hover:border-slate-300"
      style={{ borderLeft: `3px solid ${SEVERITY_RING[insight.severity]}` }}
      onClick={() => store.getState().focusNodes(insight.nodeIds)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 rounded px-1 py-px text-[11px] font-bold uppercase tracking-wide ${
              insight.source === "rule"
                ? "bg-slate-200 text-slate-600"
                : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {insight.source === "rule" ? "Rule" : "AI"}
          </span>
          <span
            dir="auto"
            className="bidi-plaintext truncate text-xs font-semibold text-slate-700"
          >
            {insight.title}
          </span>
        </div>
        <button
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-300 hover:bg-slate-100 hover:text-slate-600"
          title="Dismiss"
          aria-label="Dismiss insight"
          onClick={(e) => {
            e.stopPropagation();
            void store.getState().dismissInsight(insight.id);
          }}
        >
          ✕
        </button>
      </div>
      <p dir="auto" className="bidi-plaintext mt-1 text-xs leading-snug text-slate-600">
        {insight.body}
      </p>
      {insight.suggestedFix && (
        <button
          className="mt-1.5 rounded bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
          onClick={(e) => {
            e.stopPropagation();
            store.getState().applySuggestedFix(insight);
          }}
          title={insight.suggestedFix.description}
        >
          ⚡ Apply fix
        </button>
      )}
    </div>
  );
}

export function InsightPanel({ store }: { store: StoreApi<EditorState> }) {
  const insights = useEditor(store, (s) => s.insights);
  const suggestions = useEditor(store, (s) => s.suggestions);
  const panelTab = useEditor(store, (s) => s.panelTab);
  const suggestionsLoading = useEditor(store, (s) => s.suggestionsLoading);
  const deepAnalysisRunning = useEditor(store, (s) => s.deepAnalysisRunning);
  const usage = useEditor(store, (s) => s.usage);

  const grouped = useMemo(() => {
    const active = insights.filter((i) => i.status === "active");
    return SEVERITY_ORDER.map((severity) => ({
      severity,
      items: active.filter((i) => i.severity === severity),
    })).filter((g) => g.items.length > 0);
  }, [insights]);

  const proposed = suggestions.filter((s) => s.status === "proposed");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-4 pb-1 pt-3">
        <TabButton
          active={panelTab === "insights"}
          onClick={() => store.getState().setPanelTab("insights")}
        >
          Insights{grouped.length > 0 ? ` (${grouped.reduce((n, g) => n + g.items.length, 0)})` : ""}
        </TabButton>
        <TabButton
          active={panelTab === "suggestions"}
          onClick={() => store.getState().setPanelTab("suggestions")}
        >
          Suggestions{proposed.length > 0 ? ` (${proposed.length})` : ""}
        </TabButton>
        <TabButton
          active={panelTab === "chat"}
          onClick={() => store.getState().setPanelTab("chat")}
        >
          Chat
        </TabButton>
        <div className="grow" />
        <AnalysisStatusBadge store={store} />
      </div>

      {panelTab === "chat" ? (
        <ChatPanel store={store} />
      ) : panelTab === "insights" ? (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2">
          <button
            className="mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            disabled={deepAnalysisRunning}
            onClick={() => void store.getState().runDeepAnalysis()}
          >
            {deepAnalysisRunning ? "Deep analysis running…" : "🔬 Deep analysis (full tree)"}
          </button>
          {grouped.length === 0 && (
            <p className="mt-4 text-center text-xs text-slate-400">
              No active insights — the tree looks structurally sound.
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.severity}>
              <div className="mb-1 mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {SEVERITY_LABEL[group.severity]} ({group.items.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {group.items.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} store={store} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2">
          <button
            className="mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            disabled={suggestionsLoading}
            onClick={() => void store.getState().requestSuggestions()}
          >
            {suggestionsLoading ? "Asking for suggestions…" : "✨ Suggest metrics"}
          </button>
          {proposed.length === 0 && !suggestionsLoading && (
            <p className="mt-4 text-center text-xs text-slate-400">
              No pending suggestions. Ask for some — or right-click a node to get
              branch-specific ones.
            </p>
          )}
          {proposed.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} store={store} />
          ))}
        </div>
      )}

      <UsageMeter usage={usage} store={store} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        active ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function UsageMeter({
  usage,
  store,
}: {
  usage: { tokensUsed: number; budget: number; costUsd: number } | null;
  store: StoreApi<EditorState>;
}) {
  if (!usage) return null;
  const fraction = Math.min(usage.tokensUsed / Math.max(usage.budget, 1), 1);
  const exhausted = usage.tokensUsed >= usage.budget;
  return (
    <div className="border-t border-slate-200 px-4 py-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className={exhausted ? "font-semibold text-red-600" : undefined}>
          AI session: {Math.round(usage.tokensUsed / 1000)}k /{" "}
          {Math.round(usage.budget / 1000)}k tokens
        </span>
        <span title="Total AI spend on this tree, across sessions">
          ${usage.costUsd.toFixed(2)} total
        </span>
      </div>
      <div
        className="mt-1 h-1 overflow-hidden rounded bg-slate-100"
        role="progressbar"
        aria-label="AI session token usage"
        aria-valuemin={0}
        aria-valuemax={usage.budget}
        aria-valuenow={usage.tokensUsed}
      >
        <div
          className={`h-full rounded ${fraction > 0.9 ? "bg-red-500" : fraction > 0.7 ? "bg-amber-500" : "bg-indigo-600"}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      {exhausted && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500">
            Budget spent — AI is paused for this tree.
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Link href="/settings" className="text-slate-400 underline hover:text-slate-600">
              Raise budget
            </Link>
            <button
              className="rounded bg-red-50 px-2 py-0.5 font-medium text-red-700 hover:bg-red-100"
              onClick={() => void store.getState().resetAiSession()}
            >
              Start fresh session
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function AnalysisStatusBadge({ store }: { store: StoreApi<EditorState> }) {
  const state = useEditor(store, (s) => s.analysisState);
  if (state === "idle") return null;
  const config: Record<string, { label: string; className: string }> = {
    analyzing: { label: "AI analyzing…", className: "bg-indigo-100 text-indigo-700 animate-pulse" },
    cancelled: { label: "re-analyzing…", className: "bg-slate-100 text-slate-500" },
    offline: { label: "AI offline", className: "bg-red-100 text-red-700" },
    budget_exhausted: { label: "budget exhausted", className: "bg-amber-100 text-amber-800" },
  };
  const c = config[state];
  if (!c) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
