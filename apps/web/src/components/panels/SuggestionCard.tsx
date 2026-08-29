"use client";

import type { StoreApi } from "zustand/vanilla";
import type { Suggestion } from "@kti/schema";
import { DIRECTION_STYLE } from "@/lib/colors";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";

/** One proposed metric with its accept/reject gate. Rendered both in the
 *  Suggestions tab and inline in the chat turn that produced it. */
export function SuggestionCard({
  suggestion,
  store,
}: {
  suggestion: Suggestion;
  store: StoreApi<EditorState>;
}) {
  const parentTitle = useEditor(
    store,
    (s) => s.nodes[suggestion.parentNodeId]?.title ?? "?",
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <span
          className={`rounded px-1 py-px text-[11px] font-bold ${DIRECTION_STYLE[suggestion.direction].chip}`}
        >
          {suggestion.direction === "guard" ? "🛡" : suggestion.level}
        </span>
        <span dir="auto" className="bidi-plaintext truncate text-xs font-semibold text-slate-700">
          {suggestion.title}
        </span>
      </div>
      <div dir="auto" className="bidi-plaintext mt-1 truncate font-mono text-[11px] text-slate-500">
        {suggestion.formula}
      </div>
      <p dir="auto" className="bidi-plaintext mt-1 text-xs leading-snug text-slate-600">
        {suggestion.reason}
      </p>
      <div className="mt-1 text-[11px] text-slate-400">
        under <span dir="auto" className="bidi-plaintext">{parentTitle}</span> ·{" "}
        {suggestion.edgeType}
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
          onClick={() => store.getState().acceptSuggestion(suggestion.id)}
        >
          ✓ Accept
        </button>
        <button
          className="rounded bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
          onClick={() => void store.getState().rejectSuggestion(suggestion.id)}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}
