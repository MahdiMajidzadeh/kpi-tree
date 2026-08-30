"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import type { TreeListItem } from "@/db/repo/trees";
import { IntakeForm } from "./IntakeForm";

export function HomeScreen() {
  const [trees, setTrees] = useState<TreeListItem[] | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [newTreeOpen, setNewTreeOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [loadError, setLoadError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/trees");
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { trees: TreeListItem[] };
      setTrees(data.trees);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const response = await fetch("/api/trees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = (await response.json()) as { tree?: { id: string }; error?: string };
      if (!response.ok || !data.tree) {
        setImportError(data.error ?? "Import failed.");
        return;
      }
      router.push(`/trees/${data.tree.id}`);
    } catch {
      setImportError("Could not read that file.");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            KPI Tree Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Describe a product, get a structured KPI tree, and let the critique
            keep it honest.
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          ⚙ Settings
        </Link>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={() => setShowIntake(true)}
        >
          ✨ Generate from description
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => setNewTreeOpen(true)}
        >
          Start blank
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => fileInput.current?.click()}
        >
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImportFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {importError && (
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {loadError && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load your trees.
          <button
            className="rounded border border-red-300 px-2 py-1 text-xs font-medium hover:bg-red-100"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trees === null && !loadError && (
          <p className="text-sm text-slate-500">Loading trees…</p>
        )}
        {trees?.length === 0 && (
          <p className="text-sm text-slate-500">
            No trees yet — generate one from a product description to get started.
          </p>
        )}
        {trees?.map((tree) => (
          <TreeCard key={tree.id} tree={tree} onChanged={() => void refresh()} />
        ))}
      </div>

      {showIntake && <IntakeForm onClose={() => setShowIntake(false)} />}
      <NewTreeDialog open={newTreeOpen} onClose={() => setNewTreeOpen(false)} />
    </main>
  );
}

function NewTreeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("Untitled KPI tree");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), blank: true }),
      });
      const data = (await response.json()) as { tree?: { id: string } };
      if (!response.ok || !data.tree) {
        setError("Could not create the tree — try again.");
        return;
      }
      router.push(`/trees/${data.tree.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-base font-semibold text-slate-800">
            New blank tree
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Name it after the product or team it will measure.
          </Dialog.Description>
          <input
            autoFocus
            dir="auto"
            className="bidi-plaintext mt-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === "Enter" && void create()}
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
            </Dialog.Close>
            <button
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              {busy ? "Creating…" : "Create tree"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TreeCard({
  tree,
  onChanged,
}: {
  tree: TreeListItem;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(tree.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rename = async () => {
    setRenaming(false);
    if (name.trim() && name !== tree.name) {
      await fetch(`/api/trees/${tree.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      onChanged();
    }
  };

  const [duplicating, setDuplicating] = useState(false);
  const duplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      await fetch(`/api/trees/${tree.id}/duplicate`, { method: "POST" });
      onChanged();
    } finally {
      setDuplicating(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/trees/${tree.id}`, { method: "DELETE" });
      setConfirmingDelete(false);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
      onClick={() => router.push(`/trees/${tree.id}`)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          router.push(`/trees/${tree.id}`);
        }
      }}
    >
      {renaming ? (
        <input
          autoFocus
          dir="auto"
          className="bidi-plaintext w-full rounded border border-indigo-300 px-1 text-sm font-semibold"
          value={name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void rename()}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      ) : (
        <h2
          dir="auto"
          className="bidi-plaintext truncate text-sm font-semibold text-slate-800"
          title={tree.name}
        >
          {tree.name}
        </h2>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>
          {tree.nodeCount} metric{tree.nodeCount === 1 ? "" : "s"}
        </span>
        {tree.errorCount > 0 && (
          <span className="font-medium text-red-600">
            {tree.errorCount} error{tree.errorCount === 1 ? "" : "s"}
          </span>
        )}
        {tree.warningCount > 0 && (
          <span className="font-medium text-amber-600">
            {tree.warningCount} warning{tree.warningCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        Updated{" "}
        {new Date(tree.updatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </div>
      <div
        className="mt-3 flex gap-1 border-t border-slate-100 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => setRenaming(true)}
        >
          Rename
        </button>
        <button
          className="rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          disabled={duplicating}
          onClick={() => void duplicate()}
        >
          {duplicating ? "Duplicating…" : "Duplicate"}
        </button>
        <button
          className="rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      </div>
      <Dialog.Root
        open={confirmingDelete}
        onOpenChange={(o) => !o && !deleting && setConfirmingDelete(false)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
            <Dialog.Title className="text-base font-semibold text-slate-800">
              Delete{" "}
              <span dir="auto" className="bidi-plaintext">
                “{tree.name}”
              </span>
              ?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">
              This deletes the tree and its {tree.nodeCount} metric
              {tree.nodeCount === 1 ? "" : "s"}. This cannot be undone.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  disabled={deleting}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={() => void remove()}
              >
                {deleting ? "Deleting…" : "Delete tree"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
