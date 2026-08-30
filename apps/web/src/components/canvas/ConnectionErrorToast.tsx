"use client";

import { useEffect, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";

/** Inline rejection reason for invalid connections (FR-2.3). */
export function ConnectionErrorToast({ store }: { store: StoreApi<EditorState> }) {
  const error = useEditor(store, (s) => s.connectionError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!error) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [error]);

  if (!error || !visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        role="status"
        className="max-w-md rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl"
      >
        <span className="me-1.5">⚠️</span>
        {error.reason}
      </div>
    </div>
  );
}
