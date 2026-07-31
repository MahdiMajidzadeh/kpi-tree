"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { EditorState } from "@/stores/tree-editor-store";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/** FR-2.5 keyboard shortcuts: Del, ⌘Z, ⌘⇧Z, ⌘K. */
export function useEditorKeyboard(
  store: StoreApi<EditorState>,
  addAtCenter: () => void,
): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.getState().redo();
        else store.getState().undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        addAtCenter();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selection, deleteEdge, requestDeleteNode, deleteNodeSimple, nodes, edges } =
          store.getState();
        if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) return;
        e.preventDefault();
        for (const edgeId of selection.edgeIds) deleteEdge(edgeId);
        if (selection.nodeIds.length === 1) {
          requestDeleteNode(selection.nodeIds[0]!);
        } else {
          // Multi-select: childless nodes delete instantly; parents get the dialog.
          for (const nodeId of selection.nodeIds) {
            const hasChildren = Object.values(edges).some((ed) => ed.source === nodeId);
            if (!hasChildren && nodes[nodeId]) deleteNodeSimple(nodeId);
            else if (nodes[nodeId]) requestDeleteNode(nodeId);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, addAtCenter]);
}
