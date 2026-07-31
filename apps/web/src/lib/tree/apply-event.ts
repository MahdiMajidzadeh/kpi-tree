import type { Edge, MetricNode, MutationEvent, NodePatch } from "@kti/schema";

/** In-memory tree content, keyed by id. Shared by the client store and the
 *  server mutation pipeline so both apply events identically. */
export interface TreeContent {
  nodes: Record<string, MetricNode>;
  edges: Record<string, Edge>;
}

export function emptyContent(): TreeContent {
  return { nodes: {}, edges: {} };
}

export function contentFromArrays(nodes: MetricNode[], edges: Edge[]): TreeContent {
  const content = emptyContent();
  for (const n of nodes) content.nodes[n.id] = n;
  for (const e of edges) content.edges[e.id] = e;
  return content;
}

function applyPatch(node: MetricNode, patch: NodePatch): MetricNode {
  const next: MetricNode = { ...node };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.formula !== undefined) next.formula = patch.formula;
  if (patch.reason !== undefined) next.reason = patch.reason;
  if (patch.level !== undefined) next.level = patch.level;
  if (patch.direction !== undefined) next.direction = patch.direction;
  if (patch.timeliness !== undefined) {
    if (patch.timeliness === null) delete next.timeliness;
    else next.timeliness = patch.timeliness;
  }
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.position !== undefined) next.position = patch.position;
  return next;
}

/** Pure reducer: (content, event) → new content. Unknown targets are
 *  ignored rather than thrown so replays stay total. */
export function applyEvent(content: TreeContent, event: MutationEvent): TreeContent {
  switch (event.type) {
    case "node_added": {
      return {
        nodes: { ...content.nodes, [event.node.id]: event.node },
        edges: content.edges,
      };
    }
    case "node_removed": {
      const nodes = { ...content.nodes };
      delete nodes[event.node.id];
      const edges = { ...content.edges };
      for (const e of event.removedEdges) delete edges[e.id];
      // Defensive: drop any edge still referencing the removed node.
      for (const [id, e] of Object.entries(edges)) {
        if (e.source === event.node.id || e.target === event.node.id) {
          delete edges[id];
        }
      }
      return { nodes, edges };
    }
    case "node_modified": {
      const node = content.nodes[event.nodeId];
      if (!node) return content;
      return {
        nodes: { ...content.nodes, [event.nodeId]: applyPatch(node, event.after) },
        edges: content.edges,
      };
    }
    case "edge_added": {
      return {
        nodes: content.nodes,
        edges: { ...content.edges, [event.edge.id]: event.edge },
      };
    }
    case "edge_removed": {
      const edges = { ...content.edges };
      delete edges[event.edge.id];
      return { nodes: content.nodes, edges };
    }
    case "edge_retyped": {
      const edge = content.edges[event.edgeId];
      if (!edge) return content;
      return {
        nodes: content.nodes,
        edges: { ...content.edges, [event.edgeId]: { ...edge, type: event.after } },
      };
    }
  }
}

export function applyEvents(
  content: TreeContent,
  events: MutationEvent[],
): TreeContent {
  let current = content;
  for (const event of events) current = applyEvent(current, event);
  return current;
}
