"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TreeListItem } from "@/db/repo/trees";
import { IntakeForm } from "./IntakeForm";

export function HomeScreen() {
  const [trees, setTrees] = useState<TreeListItem[] | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/trees");
    const data = (await response.json()) as { trees: TreeListItem[] };
    setTrees(data.trees);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startBlank = async () => {
    const name = prompt("Name for the new tree:", "Untitled KPI tree");
    if (!name) return;
    const response = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, blank: true }),
    });
    const data = (await response.json()) as { tree: { id: string } };
    router.push(`/trees/${data.tree.id}`);
  };

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
          onClick={() => void startBlank()}
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

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trees === null && (
          <p className="text-sm text-slate-400">Loading trees…</p>
        )}
        {trees?.length === 0 && (
          <p className="text-sm text-slate-400">
            No trees yet — generate one from a product description to get started.
          </p>
        )}
        {trees?.map((tree) => (
          <TreeCard key={tree.id} tree={tree} onChanged={() => void refresh()} />
        ))}
      </div>

      {showIntake && <IntakeForm onClose={() => setShowIntake(false)} />}
    </main>
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

  const duplicate = async () => {
    await fetch(`/api/trees/${tree.id}/duplicate`, { method: "POST" });
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete "${tree.name}"? This cannot be undone.`)) return;
    await fetch(`/api/trees/${tree.id}`, { method: "DELETE" });
    onChanged();
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
          onKeyDown={(e) => e.key === "Enter" && void rename()}
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
      <div className="mt-1 text-[11px] text-slate-400">
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
          className="rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => setRenaming(true)}
        >
          Rename
        </button>
        <button
          className="rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => void duplicate()}
        >
          Duplicate
        </button>
        <button
          className="rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => void remove()}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
