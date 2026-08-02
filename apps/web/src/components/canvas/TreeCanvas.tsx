"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { StoreApi } from "zustand/vanilla";
import type { Severity } from "@kti/schema";
import { maxSeverity } from "@/lib/colors";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { MetricNode, type MetricFlowNode } from "./MetricNode";
import { TypedEdge, type TypedFlowEdge } from "./TypedEdge";
import { validateConnection } from "@/lib/tree/connect-guards";
import { NODE_HEIGHT, NODE_WIDTH, NS_HEIGHT, NS_WIDTH } from "./layout";

const nodeTypes = { metric: MetricNode };
const edgeTypes = { typed: TypedEdge };

export function TreeCanvas({ store }: { store: StoreApi<EditorState> }) {
  const nodes = useEditor(store, (s) => s.nodes);
  const edges = useEditor(store, (s) => s.edges);
  const violations = useEditor(store, (s) => s.violations);
  const insights = useEditor(store, (s) => s.insights);
  const focusRequest = useEditor(store, (s) => s.focusRequest);
  const selectedNodeIds = useEditor(store, (s) => s.selection.nodeIds);
  const reactFlow = useReactFlow();

  // node id → highest active severity (rules client-side + server insights)
  const severityByNode = useMemo(() => {
    const map = new Map<string, Severity[]>();
    for (const v of violations) {
      for (const id of v.nodeIds) map.set(id, [...(map.get(id) ?? []), v.severity]);
    }
    for (const insight of insights) {
      if (insight.status !== "active" || insight.source !== "agent") continue;
      for (const id of insight.nodeIds) {
        map.set(id, [...(map.get(id) ?? []), insight.severity]);
      }
    }
    const out = new Map<string, Severity | null>();
    for (const [id, severities] of map) out.set(id, maxSeverity(severities));
    return out;
  }, [violations, insights]);

  // React Flow is controlled here, so `selected` has to be fed back in from the
  // store — it never applies selection changes to the nodes prop on its own.
  const selectedSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const rfNodes = useMemo<MetricFlowNode[]>(
    () =>
      Object.values(nodes).map((node) => {
        const isNorthStar = node.level === "north_star";
        return {
          id: node.id,
          type: "metric" as const,
          position: node.position ?? { x: 0, y: 0 },
          selected: selectedSet.has(node.id),
          // MetricNode renders at these exact sizes. Declaring them keeps React
          // Flow's `nodeHasDimensions` true across node-object rebuilds — without
          // them, rebuilding drops `measured` and the node is briefly rendered
          // `visibility: hidden`, which also makes it untargetable by clicks.
          width: isNorthStar ? NS_WIDTH : NODE_WIDTH,
          height: isNorthStar ? NS_HEIGHT : NODE_HEIGHT,
          data: { node, severity: severityByNode.get(node.id) ?? null },
        };
      }),
    [nodes, severityByNode, selectedSet],
  );

  const rfEdges = useMemo<TypedFlowEdge[]>(
    () =>
      Object.values(edges).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "typed" as const,
        data: { edgeType: edge.type },
      })),
    [edges],
  );

  const dragStart = useRef(new Map<string, { x: number; y: number }>());

  const onNodesChange = useCallback(
    (changes: NodeChange<MetricFlowNode>[]) => {
      const state = store.getState();
      const selectedNodes = new Set(state.selection.nodeIds);
      let selectionChanged = false;
      for (const change of changes) {
        if (change.type === "position" && change.position && change.dragging) {
          state.setTransientPosition(change.id, change.position.x, change.position.y);
        } else if (change.type === "select") {
          selectionChanged = true;
          if (change.selected) selectedNodes.add(change.id);
          else selectedNodes.delete(change.id);
        }
      }
      if (selectionChanged) {
        state.setSelection({
          nodeIds: [...selectedNodes],
          edgeIds: state.selection.edgeIds,
        });
        const single = selectedNodes.size === 1 ? [...selectedNodes][0]! : null;
        state.setEditingNode(single);
      }
    },
    [store],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<TypedFlowEdge>[]) => {
      const state = store.getState();
      const selectedEdges = new Set(state.selection.edgeIds);
      let selectionChanged = false;
      for (const change of changes) {
        if (change.type === "select") {
          selectionChanged = true;
          if (change.selected) selectedEdges.add(change.id);
          else selectedEdges.delete(change.id);
        }
      }
      if (selectionChanged) {
        state.setSelection({
          nodeIds: state.selection.nodeIds,
          edgeIds: [...selectedEdges],
        });
      }
    },
    [store],
  );

  const onNodeDragStart = useCallback(
    (_event: unknown, _node: FlowNode, draggedNodes: FlowNode[]) => {
      dragStart.current.clear();
      for (const n of draggedNodes) {
        dragStart.current.set(n.id, { x: n.position.x, y: n.position.y });
      }
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: FlowNode, draggedNodes: FlowNode[]) => {
      const moves = draggedNodes.map((n) => ({
        id: n.id,
        to: { x: n.position.x, y: n.position.y },
        from: dragStart.current.get(n.id) ?? { x: n.position.x, y: n.position.y },
      }));
      store.getState().moveNodes(moves, { label: "Move" });
      dragStart.current.clear();
    },
    [store],
  );

  const isValidConnection = useCallback(
    (connection: Connection | TypedFlowEdge) => {
      const { nodes: n, edges: e } = store.getState();
      if (!connection.source || !connection.target) return false;
      return validateConnection(n, e, connection.source, connection.target).ok;
    },
    [store],
  );

  // Clicking a node opens it in the sidebar. This is wired explicitly rather
  // than relying on the `select` change above, so a click still reopens the
  // panel for a node that is already selected.
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      const state = store.getState();
      if (event.metaKey || event.ctrlKey || event.shiftKey) return; // multi-select
      state.setSelection({ nodeIds: [node.id], edgeIds: [] });
      state.setEditingNode(node.id);
    },
    [store],
  );

  const onPaneClick = useCallback(() => {
    const state = store.getState();
    state.setSelection({ nodeIds: [], edgeIds: [] });
    state.setEditingNode(null);
  }, [store]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault();
      store.getState().setContextMenu({
        nodeId: node.id,
        screen: { x: event.clientX, y: event.clientY },
      });
    },
    [store],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const targetNode = store.getState().nodes[connection.target];
      const flowPos = targetNode?.position ?? { x: 0, y: 0 };
      const screen = reactFlow.flowToScreenPosition({
        x: flowPos.x + 112,
        y: flowPos.y,
      });
      store.getState().tryConnect(connection.source, connection.target, screen);
    },
    [store, reactFlow],
  );

  // Insight click → pan/zoom to the referenced nodes.
  useEffect(() => {
    if (!focusRequest || focusRequest.nodeIds.length === 0) return;
    void reactFlow.fitView({
      nodes: focusRequest.nodeIds.map((id) => ({ id })),
      duration: 400,
      padding: 0.4,
      maxZoom: 1.2,
    });
  }, [focusRequest, reactFlow]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeContextMenu={onNodeContextMenu}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      deleteKeyCode={null}
      fitView
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-slate-50"
    >
      <Background gap={24} size={1.5} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-slate-100" />
    </ReactFlow>
  );
}
