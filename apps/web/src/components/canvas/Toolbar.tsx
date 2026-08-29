"use client";

import Link from "next/link";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { SnapshotsDialog } from "@/components/diff/SnapshotsDialog";
import { layoutTree } from "./layout";

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function Toolbar({ store }: { store: StoreApi<EditorState> }) {
  const treeName = useEditor(store, (s) => s.treeName);
  const treeId = useEditor(store, (s) => s.treeId);
  const treeNameForFile = treeName.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "kpi-tree";
  const canUndo = useEditor(store, (s) => s.undoStack.length > 0);
  const canRedo = useEditor(store, (s) => s.redoStack.length > 0);
  const saveState = useEditor(store, (s) => s.saveState);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const reactFlow = useReactFlow();

  const autoLayout = async () => {
    const { nodes, edges, moveNodes } = store.getState();
    const positions = await layoutTree(Object.values(nodes), Object.values(edges));
    moveNodes(
      [...positions.entries()].map(([id, to]) => ({ id, to })),
      { label: "Auto-layout" },
    );
    setTimeout(() => void reactFlow.fitView({ duration: 300, padding: 0.2 }), 50);
  };

  const addAtCenter = () => {
    const flowCenter = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2 - 160,
      y: window.innerHeight / 2 - 100,
    });
    store.getState().addNode({}, flowCenter);
  };

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
      <Link
        href="/"
        className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        title="Back to trees"
      >
        ←
      </Link>
      <span
        dir="auto"
        className="bidi-plaintext max-w-64 truncate px-1 text-sm font-semibold text-slate-800"
        title={treeName}
      >
        {treeName}
      </span>
      <span
        className={`ml-1 text-[10px] ${
          saveState === "saved"
            ? "text-slate-400"
            : saveState === "saving"
              ? "text-indigo-500"
              : "text-red-500"
        }`}
      >
        {saveState === "saved" ? "saved" : saveState === "saving" ? "saving…" : "retrying…"}
      </span>

      <div className="mx-2 h-5 w-px bg-slate-200" />

      <ToolbarButton onClick={addAtCenter} title="Add metric (⌘K)">
        + Metric
      </ToolbarButton>
      <ToolbarButton onClick={() => void autoLayout()} title="Auto-layout (ELK)">
        Auto-layout
      </ToolbarButton>
      <ToolbarButton
        onClick={() => void reactFlow.fitView({ duration: 300, padding: 0.2 })}
        title="Fit view"
      >
        Fit
      </ToolbarButton>

      <div className="mx-2 h-5 w-px bg-slate-200" />

      <ToolbarButton
        onClick={() => store.getState().undo()}
        disabled={!canUndo}
        title="Undo (⌘Z)"
      >
        ↩ Undo
      </ToolbarButton>
      <ToolbarButton
        onClick={() => store.getState().redo()}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
      >
        ↪ Redo
      </ToolbarButton>

      <div className="grow" />

      <ToolbarButton onClick={() => setSnapshotsOpen(true)} title="Snapshots + diff">
        📸 Snapshots
      </ToolbarButton>
      <ExportMenu treeId={treeId} fileName={treeNameForFile} />
      <SnapshotsDialog
        store={store}
        open={snapshotsOpen}
        onClose={() => setSnapshotsOpen(false)}
      />
    </div>
  );
}

function ExportMenu({ treeId, fileName }: { treeId: string; fileName: string }) {
  const reactFlow = useReactFlow();
  const [open, setOpen] = useState(false);
  return (
    <div
      className="group relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Export ▾
      </button>
      <div
        className={`absolute right-0 z-30 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover:visible ${
          open ? "visible" : "invisible"
        }`}
        onClick={() => setOpen(false)}
      >
        {[
          { label: "JSON (canonical)", format: "json" },
          { label: "Markdown", format: "markdown" },
          { label: "Mermaid", format: "mermaid" },
        ].map((item) => (
          <a
            key={item.format}
            href={`/api/trees/${treeId}/export?format=${item.format}`}
            className="block px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            download
          >
            {item.label}
          </a>
        ))}
        <div className="my-1 h-px bg-slate-100" />
        {(["png", "svg"] as const).map((format) => (
          <button
            key={format}
            className="block w-full px-3 py-1.5 text-start text-sm text-slate-600 hover:bg-slate-50"
            onClick={() =>
              void import("./export-image").then((m) =>
                m.exportCanvasImage(reactFlow, format, fileName),
              )
            }
          >
            {format.toUpperCase()} image
          </button>
        ))}
      </div>
    </div>
  );
}
