import type { ApplyMutationsResult } from "./apply-mutations";

type MutationListener = (treeId: string, result: ApplyMutationsResult) => void;

// globalThis-backed so dev HMR doesn't drop listeners.
const store = globalThis as unknown as {
  __ktiMutationListeners?: Set<MutationListener>;
};

function listeners(): Set<MutationListener> {
  store.__ktiMutationListeners ??= new Set();
  return store.__ktiMutationListeners;
}

/** The seam between persistence and the AI layer: the analysis queue and the
 *  SSE bus subscribe here; the mutations route publishes here. */
export function onMutationApplied(listener: MutationListener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

export function notifyMutationApplied(
  treeId: string,
  result: ApplyMutationsResult,
): void {
  for (const listener of listeners()) {
    try {
      listener(treeId, result);
    } catch (error) {
      console.error("mutation listener failed", error);
    }
  }
}
