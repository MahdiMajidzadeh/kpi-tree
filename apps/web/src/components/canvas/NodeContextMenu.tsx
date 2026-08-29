"use client";

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";

/** Right-click menu on a node: branch suggestions (FR-4.1), add child, delete. */
export function NodeContextMenu({ store }: { store: StoreApi<EditorState> }) {
  const menu = useEditor(store, (s) => s.contextMenu);
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!menu) return;
    const close = () => store.getState().setContextMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, store]);

  if (!menu) return null;
  const node = store.getState().nodes[menu.nodeId];
  if (!node) return null;

  const addChild = () => {
    const parentPos = node.position ?? { x: 0, y: 0 };
    const state = store.getState();
    const childId = state.addNode(
      { level: "input" },
      { x: parentPos.x + 40, y: parentPos.y + 170 },
    );
    state.dispatch(
      [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: "edge_added",
          edge: {
            id: crypto.randomUUID(),
            source: node.id,
            target: childId,
            type: "influence",
          },
        },
      ],
      { label: "Connect child" },
    );
    state.setContextMenu(null);
    setTimeout(
      () => void reactFlow.fitView({ nodes: [{ id: childId }], duration: 300, maxZoom: 1.2 }),
      50,
    );
  };

  return (
    <div
      role="menu"
      className="fixed z-50 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
      style={{
        left: Math.min(menu.screen.x, window.innerWidth - 240),
        top: Math.min(menu.screen.y, window.innerHeight - 160),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div dir="auto" className="bidi-plaintext truncate px-3 py-1 text-xs font-semibold text-slate-400">
        {node.title}
      </div>
      <MenuItem onClick={() => void store.getState().requestSuggestions(node.id)}>
        ✨ Suggest metrics for this branch
      </MenuItem>
      <MenuItem onClick={addChild}>＋ Add child metric</MenuItem>
      <MenuItem
        onClick={() => {
          store.getState().setContextMenu(null);
          store.getState().requestDeleteNode(node.id);
        }}
        danger
      >
        🗑 Delete…
      </MenuItem>
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      className={`block w-full px-3 py-1.5 text-start text-sm ${
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
