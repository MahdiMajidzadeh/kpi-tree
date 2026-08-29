"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { StoreApi } from "zustand/vanilla";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { subtreeToDelete } from "@/lib/tree/delete-node";

/** Deleting a node with children: subtree delete vs re-parent (FR-2.2). */
export function DeleteNodeDialog({ store }: { store: StoreApi<EditorState> }) {
  const nodeId = useEditor(store, (s) => s.deleteDialogNodeId);
  const node = useEditor(store, (s) =>
    s.deleteDialogNodeId ? (s.nodes[s.deleteDialogNodeId] ?? null) : null,
  );

  if (!nodeId || !node) return null;

  const state = store.getState();
  const doomedCount = subtreeToDelete(
    { nodes: state.nodes, edges: state.edges },
    nodeId,
  ).length;
  const childCount = Object.values(state.edges).filter(
    (e) => e.source === nodeId,
  ).length;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => !open && store.setState({ deleteDialogNodeId: null })}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-base font-semibold text-slate-800">
            Delete{" "}
            <span dir="auto" className="bidi-plaintext">
              “{node.title}”
            </span>
            ?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            This metric drives {childCount} other metric{childCount === 1 ? "" : "s"}.
            Choose what happens to them.
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-2">
            <button
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left hover:bg-red-100"
              onClick={() => store.getState().deleteNodeSubtree(nodeId)}
            >
              <div className="text-sm font-medium text-red-700">
                Delete the whole subtree
              </div>
              <div className="text-xs text-red-600/80">
                Removes {doomedCount} metric{doomedCount === 1 ? "" : "s"} (children
                still reachable elsewhere are kept).
              </div>
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => store.getState().deleteNodeReparent(nodeId)}
            >
              <div className="text-sm font-medium text-slate-700">
                Re-parent children to grandparent
              </div>
              <div className="text-xs text-slate-500">
                Children are re-wired to this metric&apos;s parent(s), keeping their
                edge types.
              </div>
            </button>
            <Dialog.Close asChild>
              <button
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                onClick={() =>
                  store.setState({ deleteDialogNodeId: null })
                }
              >
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
