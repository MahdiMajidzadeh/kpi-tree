"use client";

import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { nanoid } from "nanoid";
import { lintTree, type Violation } from "@kti/linter";
import type {
  Edge,
  EdgeType,
  Insight,
  MetricNode,
  MutationEvent,
  NodePatch,
  Suggestion,
  SuggestedFix,
  Tree,
} from "@kti/schema";
import { applyEvents, type TreeContent } from "@/lib/tree/apply-event";
import { invertEvents } from "@/lib/tree/invert-event";
import {
  deleteSubtreeEvents,
  reparentEvents,
  subtreeToDelete,
} from "@/lib/tree/delete-node";
import {
  validateConnection,
  validateEdgeType,
  type ConnectionVerdict,
} from "@/lib/tree/connect-guards";

export interface HistoryEntry {
  label: string;
  events: MutationEvent[];
  inverse: MutationEvent[];
}

export interface PendingConnection {
  source: string;
  target: string;
  screen: { x: number; y: number };
}

export type SaveState = "saved" | "saving" | "error";
export type AnalysisState =
  | "idle"
  | "analyzing"
  | "cancelled"
  | "offline"
  | "budget_exhausted";

export interface EditorState {
  treeId: string;
  treeName: string;
  nodes: Record<string, MetricNode>;
  edges: Record<string, Edge>;

  violations: Violation[];
  insights: Insight[];
  suggestions: Suggestion[];
  suggestionsLoading: boolean;
  deepAnalysisRunning: boolean;

  selection: { nodeIds: string[]; edgeIds: string[] };
  editingNodeId: string | null;
  deleteDialogNodeId: string | null;
  pendingConnection: PendingConnection | null;
  connectionError: { reason: string; at: number } | null;
  focusRequest: { nodeIds: string[]; nonce: number } | null;
  contextMenu: { nodeId: string; screen: { x: number; y: number } } | null;
  panelTab: "insights" | "suggestions";

  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  outbox: MutationEvent[][];
  saveState: SaveState;

  analysisState: AnalysisState;
  usage: { tokensUsed: number; budget: number; costUsd: number } | null;

  // core
  dispatch(
    events: MutationEvent[],
    opts?: { undoable?: boolean; label?: string },
  ): void;
  undo(): void;
  redo(): void;

  // gesture helpers (all funnel into dispatch)
  addNode(partial?: Partial<MetricNode>, position?: { x: number; y: number }): string;
  updateNode(nodeId: string, patch: NodePatch): void;
  moveNodes(
    moves: {
      id: string;
      to: { x: number; y: number };
      from?: { x: number; y: number };
    }[],
    opts?: { label?: string },
  ): void;
  setTransientPosition(nodeId: string, x: number, y: number): void;
  requestDeleteNode(nodeId: string): void;
  deleteNodeSimple(nodeId: string): void;
  deleteNodeSubtree(nodeId: string): void;
  deleteNodeReparent(nodeId: string): void;
  deleteEdge(edgeId: string): void;
  tryConnect(source: string, target: string, screen: { x: number; y: number }): void;
  confirmConnection(type: EdgeType): ConnectionVerdict;
  cancelConnection(): void;
  retypeEdge(edgeId: string, type: EdgeType): ConnectionVerdict;

  // ui
  setSelection(sel: { nodeIds: string[]; edgeIds: string[] }): void;
  setEditingNode(nodeId: string | null): void;
  focusNodes(nodeIds: string[]): void;
  setTreeName(name: string): void;
  setInsights(insights: Insight[]): void;
  upsertInsight(insight: Insight): void;
  resolveInsight(insightId: string): void;
  dismissInsight(insightId: string): Promise<void>;
  setAnalysisState(state: AnalysisState): void;
  setUsage(usage: { tokensUsed: number; budget: number; costUsd: number }): void;
  setPanelTab(tab: "insights" | "suggestions"): void;
  setContextMenu(menu: { nodeId: string; screen: { x: number; y: number } } | null): void;

  // suggestions (FR-4)
  upsertSuggestion(suggestion: Suggestion): void;
  requestSuggestions(branchNodeId?: string): Promise<void>;
  acceptSuggestion(suggestionId: string): void;
  rejectSuggestion(suggestionId: string): Promise<void>;

  // apply-fix + deep analysis
  applySuggestedFix(insight: Insight): void;
  runDeepAnalysis(): Promise<void>;

  // persistence
  flushOutbox(): Promise<void>;
}

function content(state: Pick<EditorState, "nodes" | "edges">): TreeContent {
  return { nodes: state.nodes, edges: state.edges };
}

function lint(state: Pick<EditorState, "nodes" | "edges">): Violation[] {
  return lintTree({
    nodes: Object.values(state.nodes),
    edges: Object.values(state.edges),
  });
}

const UNDO_CAP = 100;

export function createTreeEditorStore(tree: Tree, insights: Insight[]): StoreApi<EditorState> {
  let flushing = false;

  return createStore<EditorState>((set, get) => ({
    treeId: tree.id,
    treeName: tree.name,
    nodes: Object.fromEntries(tree.nodes.map((n) => [n.id, n])),
    edges: Object.fromEntries(tree.edges.map((e) => [e.id, e])),
    violations: lintTree({ nodes: tree.nodes, edges: tree.edges }),
    insights,
    suggestions: [],
    suggestionsLoading: false,
    deepAnalysisRunning: false,
    selection: { nodeIds: [], edgeIds: [] },
    editingNodeId: null,
    deleteDialogNodeId: null,
    pendingConnection: null,
    connectionError: null,
    focusRequest: null,
    contextMenu: null,
    panelTab: "insights",
    undoStack: [],
    redoStack: [],
    outbox: [],
    saveState: "saved",
    analysisState: "idle",
    usage: null,

    dispatch(events, opts = {}) {
      if (events.length === 0) return;
      const { undoable = true, label = "Edit" } = opts;
      const state = get();
      const inverse = undoable ? invertEvents(events) : [];
      const next = applyEvents(content(state), events);
      set({
        nodes: next.nodes,
        edges: next.edges,
        violations: lint(next),
        ...(undoable
          ? {
              undoStack: [
                ...state.undoStack.slice(-(UNDO_CAP - 1)),
                { label, events, inverse },
              ],
              redoStack: [],
            }
          : {}),
        outbox: [...state.outbox, events],
        saveState: "saving",
      });
      void get().flushOutbox();
    },

    undo() {
      const state = get();
      const entry = state.undoStack[state.undoStack.length - 1];
      if (!entry) return;
      set({ undoStack: state.undoStack.slice(0, -1) });
      get().dispatch(entry.inverse, { undoable: false });
      set((s) => ({ redoStack: [...s.redoStack, entry] }));
    },

    redo() {
      const state = get();
      const entry = state.redoStack[state.redoStack.length - 1];
      if (!entry) return;
      set({ redoStack: state.redoStack.slice(0, -1) });
      // Replay with fresh event ids so the append-only log stays unique.
      const replay = entry.events.map((e) => ({
        ...e,
        id: nanoid(),
        timestamp: Date.now(),
      })) as MutationEvent[];
      get().dispatch(replay, { undoable: false });
      set((s) => ({
        undoStack: [...s.undoStack, entry],
      }));
    },

    addNode(partial = {}, position = { x: 0, y: 0 }) {
      const node: MetricNode = {
        id: nanoid(),
        title: partial.title ?? "New metric",
        formula: partial.formula ?? "Define the calculation",
        reason: partial.reason ?? "",
        level: partial.level ?? "input",
        direction: partial.direction ?? "increase",
        ...(partial.timeliness ? { timeliness: partial.timeliness } : {}),
        tags: partial.tags ?? [],
        origin: partial.origin ?? "user",
        position,
      };
      get().dispatch(
        [{ id: nanoid(), timestamp: Date.now(), type: "node_added", node }],
        { label: "Add metric" },
      );
      set({ editingNodeId: node.id, selection: { nodeIds: [node.id], edgeIds: [] } });
      return node.id;
    },

    updateNode(nodeId, patch) {
      const node = get().nodes[nodeId];
      if (!node) return;
      const before: NodePatch = {};
      const after: NodePatch = {};
      for (const key of Object.keys(patch) as (keyof NodePatch)[]) {
        const nextValue = patch[key];
        const prevValue =
          key === "timeliness" ? (node.timeliness ?? null) : node[key as keyof MetricNode];
        if (JSON.stringify(nextValue) === JSON.stringify(prevValue)) continue;
        // @ts-expect-error keyed copy of a validated patch
        after[key] = nextValue;
        // @ts-expect-error keyed copy of the previous values
        before[key] = prevValue ?? (key === "timeliness" ? null : undefined);
      }
      if (Object.keys(after).length === 0) return;
      get().dispatch(
        [
          {
            id: nanoid(),
            timestamp: Date.now(),
            type: "node_modified",
            nodeId,
            before,
            after,
          },
        ],
        { label: "Edit metric" },
      );
    },

    moveNodes(moves, opts = {}) {
      const state = get();
      const events: MutationEvent[] = [];
      for (const move of moves) {
        const node = state.nodes[move.id];
        if (!node) continue;
        // `from` must come from the drag-start snapshot when transient
        // updates already moved the store position during the drag.
        const prev = move.from ?? node.position ?? { x: 0, y: 0 };
        if (prev.x === move.to.x && prev.y === move.to.y) continue;
        events.push({
          id: nanoid(),
          timestamp: Date.now(),
          type: "node_modified",
          nodeId: move.id,
          before: { position: prev },
          after: { position: move.to },
        });
      }
      get().dispatch(events, { label: opts.label ?? "Move" });
    },

    setTransientPosition(nodeId, x, y) {
      // During drag only: no mutation event, no undo entry, no autosave.
      const node = get().nodes[nodeId];
      if (!node) return;
      set((s) => ({
        nodes: { ...s.nodes, [nodeId]: { ...node, position: { x, y } } },
      }));
    },

    requestDeleteNode(nodeId) {
      const state = get();
      const hasChildren = Object.values(state.edges).some((e) => e.source === nodeId);
      if (hasChildren) {
        set({ deleteDialogNodeId: nodeId });
      } else {
        get().deleteNodeSimple(nodeId);
      }
    },

    deleteNodeSimple(nodeId) {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) return;
      const incident = Object.values(state.edges).filter(
        (e) => e.source === nodeId || e.target === nodeId,
      );
      get().dispatch(
        [
          {
            id: nanoid(),
            timestamp: Date.now(),
            type: "node_removed",
            node,
            removedEdges: incident,
          },
        ],
        { label: "Delete metric" },
      );
      set({ deleteDialogNodeId: null, editingNodeId: null });
    },

    deleteNodeSubtree(nodeId) {
      const state = get();
      const events = deleteSubtreeEvents(content(state), nodeId);
      const count = subtreeToDelete(content(state), nodeId).length;
      get().dispatch(events, { label: `Delete subtree (${count})` });
      set({ deleteDialogNodeId: null, editingNodeId: null });
    },

    deleteNodeReparent(nodeId) {
      const state = get();
      const events = reparentEvents(content(state), nodeId);
      get().dispatch(events, { label: "Delete + re-parent" });
      set({ deleteDialogNodeId: null, editingNodeId: null });
    },

    deleteEdge(edgeId) {
      const edge = get().edges[edgeId];
      if (!edge) return;
      get().dispatch(
        [{ id: nanoid(), timestamp: Date.now(), type: "edge_removed", edge }],
        { label: "Delete edge" },
      );
    },

    tryConnect(source, target, screen) {
      const state = get();
      const verdict = validateConnection(state.nodes, state.edges, source, target);
      if (!verdict.ok) {
        set({ connectionError: { reason: verdict.reason, at: Date.now() } });
        return;
      }
      set({ pendingConnection: { source, target, screen }, connectionError: null });
    },

    confirmConnection(type) {
      const state = get();
      const pending = state.pendingConnection;
      if (!pending) return { ok: false, reason: "No pending connection." };
      const verdict = validateEdgeType(
        state.nodes,
        state.edges,
        pending.source,
        pending.target,
        type,
      );
      if (!verdict.ok) {
        set({ connectionError: { reason: verdict.reason, at: Date.now() } });
        return verdict;
      }
      const edge: Edge = {
        id: nanoid(),
        source: pending.source,
        target: pending.target,
        type,
      };
      get().dispatch(
        [{ id: nanoid(), timestamp: Date.now(), type: "edge_added", edge }],
        { label: "Connect" },
      );
      set({ pendingConnection: null });
      return { ok: true };
    },

    cancelConnection() {
      set({ pendingConnection: null });
    },

    retypeEdge(edgeId, type) {
      const state = get();
      const edge = state.edges[edgeId];
      if (!edge) return { ok: false, reason: "Edge not found." };
      if (edge.type === type) return { ok: true };
      const verdict = validateEdgeType(
        state.nodes,
        state.edges,
        edge.source,
        edge.target,
        type,
      );
      if (!verdict.ok) {
        set({ connectionError: { reason: verdict.reason, at: Date.now() } });
        return verdict;
      }
      get().dispatch(
        [
          {
            id: nanoid(),
            timestamp: Date.now(),
            type: "edge_retyped",
            edgeId,
            before: edge.type,
            after: type,
          },
        ],
        { label: "Retype edge" },
      );
      return { ok: true };
    },

    setSelection(selection) {
      set({ selection });
    },

    setEditingNode(nodeId) {
      set({ editingNodeId: nodeId });
    },

    focusNodes(nodeIds) {
      set({ focusRequest: { nodeIds, nonce: Date.now() } });
    },

    setTreeName(name) {
      set({ treeName: name });
    },

    setInsights(insights) {
      set({ insights });
    },

    upsertInsight(insight) {
      set((s) => {
        const existing = s.insights.findIndex((i) => i.id === insight.id);
        if (existing >= 0) {
          const next = [...s.insights];
          next[existing] = insight;
          return { insights: next };
        }
        return { insights: [...s.insights, insight] };
      });
    },

    resolveInsight(insightId) {
      set((s) => ({ insights: s.insights.filter((i) => i.id !== insightId) }));
    },

    async dismissInsight(insightId) {
      get().resolveInsight(insightId);
      try {
        await fetch(`/api/insights/${insightId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        });
      } catch {
        // Non-fatal: server state reconciles on next refetch.
      }
    },

    setAnalysisState(analysisState) {
      set({ analysisState });
    },

    setUsage(usage) {
      set({ usage });
    },

    setPanelTab(panelTab) {
      set({ panelTab });
    },

    setContextMenu(contextMenu) {
      set({ contextMenu });
    },

    upsertSuggestion(suggestion) {
      set((s) => {
        const index = s.suggestions.findIndex((x) => x.id === suggestion.id);
        if (index >= 0) {
          const next = [...s.suggestions];
          next[index] = suggestion;
          return { suggestions: next };
        }
        return { suggestions: [...s.suggestions, suggestion], panelTab: "suggestions" };
      });
    },

    async requestSuggestions(branchNodeId) {
      set({ suggestionsLoading: true, panelTab: "suggestions", contextMenu: null });
      try {
        const response = await fetch(`/api/trees/${get().treeId}/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(branchNodeId ? { branchNodeId } : {}),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          set({
            connectionError: {
              reason: data.error ?? "Suggestion request failed.",
              at: Date.now(),
            },
          });
        }
      } catch {
        set({
          connectionError: { reason: "Could not reach the server.", at: Date.now() },
        });
      } finally {
        set({ suggestionsLoading: false });
      }
    },

    acceptSuggestion(suggestionId) {
      const state = get();
      const suggestion = state.suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;
      const parent = state.nodes[suggestion.parentNodeId];
      const position = parent?.position
        ? { x: parent.position.x + 60, y: parent.position.y + 160 }
        : { x: 0, y: 0 };
      const node: MetricNode = {
        id: nanoid(),
        title: suggestion.title,
        formula: suggestion.formula,
        reason: suggestion.reason,
        level: suggestion.level,
        direction: suggestion.direction,
        ...(suggestion.timeliness ? { timeliness: suggestion.timeliness } : {}),
        tags: [],
        origin: "suggested_accepted",
        position,
      };
      const edge: Edge = {
        id: nanoid(),
        source: suggestion.parentNodeId,
        target: node.id,
        type: suggestion.edgeType,
      };
      get().dispatch(
        [
          { id: nanoid(), timestamp: Date.now(), type: "node_added", node },
          { id: nanoid(), timestamp: Date.now(), type: "edge_added", edge },
        ],
        { label: "Accept suggestion" },
      );
      set((s) => ({
        suggestions: s.suggestions.filter((x) => x.id !== suggestionId),
        focusRequest: { nodeIds: [node.id], nonce: Date.now() },
      }));
      void fetch(`/api/suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }).catch(() => {});
    },

    async rejectSuggestion(suggestionId) {
      set((s) => ({
        suggestions: s.suggestions.filter((x) => x.id !== suggestionId),
      }));
      try {
        await fetch(`/api/suggestions/${suggestionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        });
      } catch {
        // rejection list is best-effort client-side; server state reconciles later
      }
    },

    applySuggestedFix(insight) {
      const fix: SuggestedFix | undefined = insight.suggestedFix;
      if (!fix) return;
      const state = get();
      const events: MutationEvent[] = [];
      let content = { nodes: { ...state.nodes }, edges: { ...state.edges } };
      let appliedUpTo = 0;

      for (const op of fix.ops) {
        switch (op.op) {
          case "add_node": {
            const parent = content.nodes[op.parentId];
            if (!parent) break;
            const node: MetricNode = {
              id: nanoid(),
              title: op.node.title,
              formula: op.node.formula,
              reason: op.node.reason,
              level: op.node.level,
              direction: op.node.direction,
              ...(op.node.timeliness ? { timeliness: op.node.timeliness } : {}),
              tags: op.node.tags ?? [],
              origin: "suggested_accepted",
              position: parent.position
                ? { x: parent.position.x + 60, y: parent.position.y + 160 }
                : { x: 0, y: 0 },
            };
            events.push(
              { id: nanoid(), timestamp: Date.now(), type: "node_added", node },
              {
                id: nanoid(),
                timestamp: Date.now(),
                type: "edge_added",
                edge: { id: nanoid(), source: op.parentId, target: node.id, type: op.edgeType },
              },
            );
            break;
          }
          case "add_edge": {
            const verdict = validateConnection(content.nodes, content.edges, op.source, op.target);
            if (!verdict.ok) break;
            events.push({
              id: nanoid(),
              timestamp: Date.now(),
              type: "edge_added",
              edge: {
                id: nanoid(),
                source: op.source,
                target: op.target,
                type: op.type,
                ...(op.note ? { note: op.note } : {}),
              },
            });
            break;
          }
          case "update_node": {
            const node = content.nodes[op.nodeId];
            if (!node) break;
            const before: NodePatch = {};
            for (const key of Object.keys(op.fields) as (keyof NodePatch)[]) {
              // @ts-expect-error keyed copy of current values for undo
              before[key] =
                key === "timeliness" ? (node.timeliness ?? null) : node[key as keyof MetricNode];
            }
            events.push({
              id: nanoid(),
              timestamp: Date.now(),
              type: "node_modified",
              nodeId: op.nodeId,
              before,
              after: op.fields,
            });
            break;
          }
          case "remove_edge": {
            const edge = content.edges[op.edgeId];
            if (!edge) break;
            events.push({ id: nanoid(), timestamp: Date.now(), type: "edge_removed", edge });
            break;
          }
          case "retype_edge": {
            const edge = content.edges[op.edgeId];
            if (!edge || edge.type === op.type) break;
            events.push({
              id: nanoid(),
              timestamp: Date.now(),
              type: "edge_retyped",
              edgeId: op.edgeId,
              before: edge.type,
              after: op.type,
            });
            break;
          }
        }
        content = applyEvents(content, events.slice(appliedUpTo));
        appliedUpTo = events.length;
      }

      if (events.length === 0) {
        set({
          connectionError: {
            reason: "This fix no longer applies to the current tree.",
            at: Date.now(),
          },
        });
        return;
      }
      get().dispatch(events, { label: "Apply fix" });
      get().resolveInsight(insight.id);
      void fetch(`/api/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      }).catch(() => {});
    },

    async runDeepAnalysis() {
      set({ deepAnalysisRunning: true, panelTab: "insights" });
      try {
        const response = await fetch(`/api/trees/${get().treeId}/deep-analysis`, {
          method: "POST",
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          set({
            connectionError: {
              reason: data.error ?? "Deep analysis failed to start.",
              at: Date.now(),
            },
          });
        }
      } catch {
        set({
          connectionError: { reason: "Could not reach the server.", at: Date.now() },
        });
      } finally {
        set({ deepAnalysisRunning: false });
      }
    },

    async flushOutbox() {
      if (flushing) return;
      flushing = true;
      try {
        while (get().outbox.length > 0) {
          const batch = get().outbox[0]!;
          try {
            const response = await fetch(`/api/trees/${get().treeId}/mutations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ events: batch }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = (await response.json()) as {
              added: Insight[];
              resolved: string[];
            };
            set((s) => {
              const resolvedSet = new Set(data.resolved);
              const kept = s.insights.filter((i) => !resolvedSet.has(i.id));
              const knownIds = new Set(kept.map((i) => i.id));
              const added = data.added.filter((i) => !knownIds.has(i.id));
              return {
                outbox: s.outbox.slice(1),
                insights: [...kept, ...added],
              };
            });
          } catch (error) {
            console.error("autosave failed; retrying", error);
            set({ saveState: "error" });
            setTimeout(() => {
              flushing = false;
              void get().flushOutbox();
            }, 2000);
            return;
          }
        }
        set({ saveState: "saved" });
      } finally {
        flushing = false;
      }
    },
  }));
}

// Store instances survive route navigation within the SPA session so
// undo history persists when the user visits home and comes back (FR-2.5).
const storeCache = new Map<string, StoreApi<EditorState>>();

export function getOrCreateTreeEditorStore(
  tree: Tree,
  insights: Insight[],
): StoreApi<EditorState> {
  const cached = storeCache.get(tree.id);
  if (cached) return cached;
  const store = createTreeEditorStore(tree, insights);
  storeCache.set(tree.id, store);
  return store;
}

export function dropTreeEditorStore(treeId: string): void {
  storeCache.delete(treeId);
}

export function useEditor<T>(
  store: StoreApi<EditorState>,
  selector: (state: EditorState) => T,
): T {
  return useStore(store, selector);
}
