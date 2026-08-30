"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useState } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import type { Insight, Tree } from "@kti/schema";
import {
  getOrCreateTreeEditorStore,
  type EditorState,
} from "@/stores/tree-editor-store";
import { useEditorKeyboard } from "@/lib/keyboard";
import { useTreeEvents } from "@/lib/ai/useTreeEvents";
import { TreeCanvas } from "@/components/canvas/TreeCanvas";
import { NodeContextMenu } from "@/components/canvas/NodeContextMenu";
import { Toolbar } from "@/components/canvas/Toolbar";
import { ConnectionErrorToast } from "@/components/canvas/ConnectionErrorToast";
import { NodeEditorPanel } from "@/components/panels/NodeEditorPanel";
import { EdgeTypePicker } from "@/components/panels/EdgeTypePicker";
import { DeleteNodeDialog } from "@/components/panels/DeleteNodeDialog";
import { InsightPanel } from "@/components/panels/InsightPanel";
import { layoutTree } from "@/components/canvas/layout";

function EditorShell({ store }: { store: StoreApi<EditorState> }) {
  const reactFlow = useReactFlow();

  const addAtCenter = useCallback(() => {
    const flowCenter = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2 - 160,
      y: window.innerHeight / 2 - 100,
    });
    store.getState().addNode({}, flowCenter);
  }, [reactFlow, store]);

  useEditorKeyboard(store, addAtCenter);
  useTreeEvents(store);

  // Nodes without saved positions (fresh generation/import) get a layout pass.
  useEffect(() => {
    const { nodes, edges, moveNodes } = store.getState();
    const unpositioned = Object.values(nodes).filter((n) => !n.position);
    if (unpositioned.length === 0) return;
    void layoutTree(Object.values(nodes), Object.values(edges)).then((positions) => {
      moveNodes(
        [...positions.entries()].map(([id, to]) => ({ id, to })),
        { label: "Initial layout" },
      );
      // The automatic first layout shouldn't sit on the undo stack.
      store.setState({ undoStack: [], redoStack: [] });
      setTimeout(() => void reactFlow.fitView({ padding: 0.2 }), 50);
    });
  }, [store, reactFlow]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar store={store} />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <TreeCanvas store={store} />
        </div>
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
          <NodeEditorPanel store={store} />
          <InsightPanel store={store} />
        </aside>
      </div>
      <EdgeTypePicker store={store} />
      <DeleteNodeDialog store={store} />
      <NodeContextMenu store={store} />
      <ConnectionErrorToast store={store} />
    </div>
  );
}

export function TreeEditor({ treeId }: { treeId: string }) {
  const [store, setStore] = useState<StoreApi<EditorState> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/trees/${treeId}`);
        if (!response.ok) {
          setError(response.status === 404 ? "Tree not found." : "Failed to load tree.");
          return;
        }
        const data = (await response.json()) as { tree: Tree; insights: Insight[] };
        if (cancelled) return;
        setStore(getOrCreateTreeEditorStore(data.tree, data.insights));
      } catch {
        if (!cancelled) setError("Failed to load tree.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [treeId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        {error}
      </div>
    );
  }
  if (!store) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading tree…
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <EditorShell store={store} />
    </ReactFlowProvider>
  );
}
