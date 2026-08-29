"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { StoreApi } from "zustand/vanilla";
import type { TreeFile } from "@kti/schema";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { SnapshotDiffView } from "./SnapshotDiffView";

interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: number;
}

type DiffTarget = { kind: "current" } | { kind: "snapshot"; id: string };

export function SnapshotsDialog({
  store,
  open,
  onClose,
}: {
  store: StoreApi<EditorState>;
  open: boolean;
  onClose: () => void;
}) {
  const treeId = useEditor(store, (s) => s.treeId);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [name, setName] = useState("");
  const [baseline, setBaseline] = useState<string | null>(null);
  const [diff, setDiff] = useState<{
    before: TreeFile["tree"];
    after: TreeFile["tree"];
    title: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/trees/${treeId}/snapshots`);
    const data = (await response.json()) as { snapshots: SnapshotMeta[] };
    setSnapshots(data.snapshots);
  }, [treeId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch(`/api/trees/${treeId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setName("");
    void refresh();
  };

  const loadSnapshot = async (id: string): Promise<TreeFile["tree"]> => {
    const response = await fetch(`/api/snapshots/${id}`);
    const data = (await response.json()) as { snapshot: { treeFile: TreeFile } };
    return data.snapshot.treeFile.tree;
  };

  const currentState = () => {
    const s = store.getState();
    return {
      nodes: Object.values(s.nodes),
      edges: Object.values(s.edges),
    } as TreeFile["tree"];
  };

  const compare = async (target: DiffTarget) => {
    if (!baseline) return;
    const before = await loadSnapshot(baseline);
    const baseName = snapshots.find((s) => s.id === baseline)?.name ?? "snapshot";
    if (target.kind === "current") {
      setDiff({ before, after: currentState(), title: `${baseName} → current` });
    } else {
      const after = await loadSnapshot(target.id);
      const afterName = snapshots.find((s) => s.id === target.id)?.name ?? "snapshot";
      setDiff({ before, after, title: `${baseName} → ${afterName}` });
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
    if (baseline === id) setBaseline(null);
    void refresh();
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <Dialog.Title className="text-base font-semibold text-slate-800">
              Snapshots
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-slate-500">
              Name a moment ("Before Q3 planning"), then compare any snapshot with
              another — or with the current tree.
            </Dialog.Description>

            <div className="mt-3 flex gap-2">
              <input
                dir="auto"
                className="bidi-plaintext grow rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Snapshot name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
              />
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={!name.trim()}
                onClick={() => void create()}
              >
                Snapshot now
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              {snapshots.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">
                  No snapshots yet.
                </p>
              )}
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    baseline === snapshot.id
                      ? "border-indigo-400 bg-indigo-50/50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="min-w-0 grow">
                    <div dir="auto" className="bidi-plaintext truncate text-sm font-medium text-slate-700">
                      {snapshot.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {baseline === snapshot.id ? (
                    <span className="text-[10px] font-semibold text-indigo-600">
                      baseline
                    </span>
                  ) : baseline ? (
                    <button
                      className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                      onClick={() => void compare({ kind: "snapshot", id: snapshot.id })}
                    >
                      Compare
                    </button>
                  ) : null}
                  <button
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={() =>
                      setBaseline(baseline === snapshot.id ? null : snapshot.id)
                    }
                  >
                    {baseline === snapshot.id ? "Unset" : "Set baseline"}
                  </button>
                  <button
                    className="rounded px-1.5 py-1 text-xs text-red-400 hover:bg-red-50"
                    onClick={() => void remove(snapshot.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {baseline && (
              <button
                className="mt-3 w-full rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                onClick={() => void compare({ kind: "current" })}
              >
                Compare baseline → current tree
              </button>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {diff && (
        <Dialog.Root open onOpenChange={(o) => !o && setDiff(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content className="fixed inset-6 z-50 flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                <Dialog.Title className="text-sm font-semibold text-slate-800">
                  Diff: {diff.title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
                    Close ✕
                  </button>
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1">
                <SnapshotDiffView before={diff.before} after={diff.after} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
