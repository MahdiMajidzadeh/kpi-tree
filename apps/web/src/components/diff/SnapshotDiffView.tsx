"use client";

import { useMemo } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  type Edge as FlowEdge,
} from "@xyflow/react";
import type { Edge, MetricNode as MetricNodeData } from "@kti/schema";
import { diffTrees } from "@/lib/tree/diff-trees";
import { MetricNode, type MetricFlowNode, type DiffState } from "@/components/canvas/MetricNode";
import { TypedEdge, type TypedFlowEdge } from "@/components/canvas/TypedEdge";

const nodeTypes = { metric: MetricNode };
const edgeTypes = { typed: TypedEdge };

interface TreeState {
  nodes: MetricNodeData[];
  edges: Edge[];
}

/** Read-only union-graph diff (P2): added green, removed red + faded,
 *  modified amber. Reuses the editor's node/edge components. */
export function SnapshotDiffView({
  before,
  after,
}: {
  before: TreeState;
  after: TreeState;
}) {
  const { rfNodes, rfEdges, summary } = useMemo(() => {
    const diff = diffTrees(before, after);
    const changedById = new Map(diff.changedNodes.map((c) => [c.after.id, c]));
    const addedIds = new Set(diff.addedNodes.map((n) => n.id));
    const removedPairs = new Set(diff.removedEdges.map((e) => `${e.source}→${e.target}`));
    const addedPairs = new Set(diff.addedEdges.map((e) => `${e.source}→${e.target}`));
    const retypedPairs = new Set(
      diff.retypedEdges.map((r) => `${r.after.source}→${r.after.target}`),
    );

    // Union graph: current nodes plus removed ones (kept at their old spot).
    const nodes: MetricFlowNode[] = [
      ...after.nodes.map((node) => {
        const change = changedById.get(node.id);
        const diffState: DiffState | undefined = addedIds.has(node.id)
          ? "added"
          : change
            ? "modified"
            : undefined;
        return {
          id: node.id,
          type: "metric" as const,
          position: node.position ?? { x: 0, y: 0 },
          data: {
            node: change
              ? { ...node, reason: `Changed: ${change.fields.join(", ")}. ${node.reason}` }
              : node,
            severity: null,
            ...(diffState ? { diff: diffState } : {}),
          },
          draggable: false,
          connectable: false,
        };
      }),
      ...diff.removedNodes.map((node) => ({
        id: node.id,
        type: "metric" as const,
        position: node.position ?? { x: 40, y: 40 },
        data: { node, severity: null, diff: "removed" as const },
        draggable: false,
        connectable: false,
      })),
    ];

    const pair = (e: Edge) => `${e.source}→${e.target}`;
    const edges: TypedFlowEdge[] = [
      ...after.edges.map((edge) => ({
        id: `after-${edge.id}`,
        source: edge.source,
        target: edge.target,
        type: "typed" as const,
        data: {
          edgeType: edge.type,
          ...(addedPairs.has(pair(edge))
            ? { diff: "added" as const }
            : retypedPairs.has(pair(edge))
              ? { diff: "modified" as const }
              : {}),
        },
      })),
      ...diff.removedEdges.map((edge) => ({
        id: `removed-${edge.id}`,
        source: edge.source,
        target: edge.target,
        type: "typed" as const,
        data: { edgeType: edge.type, diff: "removed" as const },
      })),
    ];

    return {
      rfNodes: nodes,
      rfEdges: edges,
      summary: {
        added: diff.addedNodes.length,
        removed: diff.removedNodes.length,
        modified: diff.changedNodes.length,
        edgesChanged:
          diff.addedEdges.length + diff.removedEdges.length + diff.retypedEdges.length,
      },
    };
  }, [before, after]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <Legend color="#16a34a" label={`${summary.added} added`} />
        <Legend color="#dc2626" label={`${summary.removed} removed`} />
        <Legend color="#d97706" label={`${summary.modified} modified`} />
        <span className="text-slate-400">{summary.edgesChanged} edge changes</span>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.1}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
          >
            <Background gap={24} size={1.5} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
