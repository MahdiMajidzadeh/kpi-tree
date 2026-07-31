import type { Edge, MetricNode } from "@kti/schema";

export interface NodeChange {
  before: MetricNode;
  after: MetricNode;
  fields: string[];
}

export interface EdgeRetype {
  before: Edge;
  after: Edge;
}

export interface TreeDiff {
  addedNodes: MetricNode[];
  removedNodes: MetricNode[];
  changedNodes: NodeChange[];
  addedEdges: Edge[];
  removedEdges: Edge[];
  retypedEdges: EdgeRetype[];
}

const COMPARED_FIELDS = [
  "title",
  "formula",
  "reason",
  "level",
  "direction",
  "timeliness",
  "tags",
] as const;

/** Structural diff between two tree states (P2 snapshots). Nodes are keyed
 *  by id; edges by (source, target) pair — semantic identity survives
 *  delete/re-create cycles better than edge ids do. Positions are ignored. */
export function diffTrees(
  before: { nodes: MetricNode[]; edges: Edge[] },
  after: { nodes: MetricNode[]; edges: Edge[] },
): TreeDiff {
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  const addedNodes = after.nodes.filter((n) => !beforeNodes.has(n.id));
  const removedNodes = before.nodes.filter((n) => !afterNodes.has(n.id));
  const changedNodes: NodeChange[] = [];
  for (const [id, b] of beforeNodes) {
    const a = afterNodes.get(id);
    if (!a) continue;
    const fields = COMPARED_FIELDS.filter(
      (f) => JSON.stringify(b[f] ?? null) !== JSON.stringify(a[f] ?? null),
    );
    if (fields.length > 0) changedNodes.push({ before: b, after: a, fields: [...fields] });
  }

  const pair = (e: Edge) => `${e.source}→${e.target}`;
  const beforeEdges = new Map(before.edges.map((e) => [pair(e), e]));
  const afterEdges = new Map(after.edges.map((e) => [pair(e), e]));

  const addedEdges = after.edges.filter((e) => !beforeEdges.has(pair(e)));
  const removedEdges = before.edges.filter((e) => !afterEdges.has(pair(e)));
  const retypedEdges: EdgeRetype[] = [];
  for (const [key, b] of beforeEdges) {
    const a = afterEdges.get(key);
    if (a && a.type !== b.type) retypedEdges.push({ before: b, after: a });
  }

  return { addedNodes, removedNodes, changedNodes, addedEdges, removedEdges, retypedEdges };
}
