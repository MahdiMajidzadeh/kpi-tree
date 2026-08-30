"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { EdgeType } from "@kti/schema";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";

const TYPES: { value: EdgeType; label: string; hint: string }[] = [
  { value: "influence", label: "→ Influence", hint: "Causal / correlational (default)" },
  { value: "multiplicative", label: "× Multiplicative", hint: "Children multiply to parent" },
  { value: "additive", label: "+ Additive", hint: "Children sum to parent" },
  { value: "guard", label: "🛡 Guard", hint: "Counter-metric relationship" },
];

/** Popover shown right after a successful connect gesture (FR-2.3). */
export function EdgeTypePicker({ store }: { store: StoreApi<EditorState> }) {
  const pending = useEditor(store, (s) => s.pendingConnection);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.getState().cancelConnection();
      // Enter is handled by the focused option button (the default,
      // "influence", is auto-focused when the picker opens).
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement))
        store.getState().confirmConnection("influence");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, store]);

  if (!pending) return null;

  const sourceTitle = store.getState().nodes[pending.source]?.title ?? "?";
  const targetTitle = store.getState().nodes[pending.target]?.title ?? "?";

  return (
    <div
      className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
      style={{
        left: Math.min(pending.screen.x, window.innerWidth - 280),
        top: Math.min(pending.screen.y, window.innerHeight - 240),
      }}
    >
      <div className="px-2 py-1 text-xs text-slate-500">
        <span dir="auto" className="bidi-plaintext font-medium">{sourceTitle}</span>
        {" → "}
        <span dir="auto" className="bidi-plaintext font-medium">{targetTitle}</span>
      </div>
      {TYPES.map((t, index) => (
        <button
          key={t.value}
          autoFocus={index === 0}
          className="flex w-full flex-col items-start rounded px-2 py-1.5 text-start hover:bg-indigo-50"
          onClick={() => store.getState().confirmConnection(t.value)}
        >
          <span className="text-sm font-medium text-slate-800">{t.label}</span>
          <span className="text-xs text-slate-500">{t.hint}</span>
        </button>
      ))}
      <button
        className="mt-1 w-full rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
        onClick={() => store.getState().cancelConnection()}
      >
        Cancel (Esc)
      </button>
    </div>
  );
}
