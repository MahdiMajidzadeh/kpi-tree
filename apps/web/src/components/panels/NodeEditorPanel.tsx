"use client";

import { useEffect, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { Direction, Level, NodePatch, Timeliness } from "@kti/schema";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";

const LEVELS: { value: Level; label: string }[] = [
  { value: "north_star", label: "North Star" },
  { value: "driver", label: "Driver" },
  { value: "input", label: "Input (leaf)" },
];

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "increase", label: "↑ Increase" },
  { value: "decrease", label: "↓ Decrease" },
  { value: "guard", label: "🛡 Guard (hold in bounds)" },
];

const TIMELINESS: { value: Timeliness | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "leading", label: "Leading" },
  { value: "lagging", label: "Lagging" },
];

export function NodeEditorPanel({ store }: { store: StoreApi<EditorState> }) {
  const editingNodeId = useEditor(store, (s) => s.editingNodeId);
  const node = useEditor(store, (s) =>
    s.editingNodeId ? (s.nodes[s.editingNodeId] ?? null) : null,
  );

  const [title, setTitle] = useState("");
  const [formula, setFormula] = useState("");
  const [reason, setReason] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setFormula(node.formula);
    setReason(node.reason);
    setTags((node.tags ?? []).join(", "));
  }, [editingNodeId, node?.title, node?.formula, node?.reason, node?.tags, node]);

  if (!node) return null;

  const commit = (patch: NodePatch) => {
    store.getState().updateNode(node.id, patch);
  };

  return (
    <div className="flex max-h-[60%] shrink-0 flex-col gap-2 overflow-y-auto border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Metric</h2>
        <button
          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          onClick={() => store.getState().requestDeleteNode(node.id)}
        >
          Delete
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Title
        <input
          dir="auto"
          className="bidi-plaintext rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && commit({ title: title.trim() })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Formula
        <input
          dir="auto"
          className="bidi-plaintext rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onBlur={() => formula.trim() && commit({ formula: formula.trim() })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Why does this metric belong here?
        <textarea
          dir="auto"
          rows={3}
          className="bidi-plaintext resize-none rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => commit({ reason })}
          placeholder="A metric without a reason is incomplete."
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Level
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={node.level}
            onChange={(e) => commit({ level: e.target.value as Level })}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Direction
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={node.direction}
            onChange={(e) => commit({ direction: e.target.value as Direction })}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Timeliness
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={node.timeliness ?? ""}
            onChange={(e) =>
              commit({
                timeliness: e.target.value === "" ? null : (e.target.value as Timeliness),
              })
            }
          >
            {TIMELINESS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Tags
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={tags}
            placeholder="retention, supply-side"
            onChange={(e) => setTags(e.target.value)}
            onBlur={() =>
              commit({
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>
    </div>
  );
}
