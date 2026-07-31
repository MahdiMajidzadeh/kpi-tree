import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, MetricNode } from "@kti/schema";

const elk = new ELK();

export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 88;
export const NS_WIDTH = 288;
export const NS_HEIGHT = 104;

export function nodeSize(node: MetricNode): { width: number; height: number } {
  return node.level === "north_star"
    ? { width: NS_WIDTH, height: NS_HEIGHT }
    : { width: NODE_WIDTH, height: NODE_HEIGHT };
}

/** ELK layered layout, top-down. Returns new positions keyed by node id. */
export async function layoutTree(
  nodes: MetricNode[],
  edges: Edge[],
): Promise<Map<string, { x: number; y: number }>> {
  if (nodes.length === 0) return new Map();
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.spacing.nodeNode": "40",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: nodes.map((n) => ({ id: n.id, ...nodeSize(n) })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const result = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return positions;
}
