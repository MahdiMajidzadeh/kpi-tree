import { nanoid } from "nanoid";
import type { Edge, MetricNode, MutationEvent } from "@kti/schema";

type Content = {
  nodes: Record<string, MetricNode>;
  edges: Record<string, Edge>;
};

function now(): number {
  return Date.now();
}

function removalEvents(content: Content, nodeIds: string[]): MutationEvent[] {
  const doomed = new Set(nodeIds);
  const claimed = new Set<string>(); // each edge appears in exactly one event
  const events: MutationEvent[] = [];
  for (const id of nodeIds) {
    const node = content.nodes[id];
    if (!node) continue;
    const incident = Object.values(content.edges).filter(
      (e) => (e.source === id || e.target === id) && !claimed.has(e.id),
    );
    for (const e of incident) claimed.add(e.id);
    events.push({
      id: nanoid(),
      timestamp: now(),
      type: "node_removed",
      node,
      removedEdges: incident,
    });
  }
  // Sanity: no event should reference a surviving edge twice — covered by `claimed`.
  void doomed;
  return events;
}

/** Descendants that would become unreachable from the North Star if `nodeId`
 *  were removed (multi-parent nodes with surviving parents are kept). */
export function subtreeToDelete(content: Content, nodeId: string): string[] {
  const northStar = Object.values(content.nodes).find(
    (n) => n.level === "north_star",
  );
  const descendants = new Set<string>();
  {
    const stack = [nodeId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const e of Object.values(content.edges)) {
        if (e.source === cur && !descendants.has(e.target) && e.target !== nodeId) {
          descendants.add(e.target);
          stack.push(e.target);
        }
      }
    }
  }
  if (!northStar || northStar.id === nodeId) {
    // No root to measure reachability from: the whole subtree goes.
    return [nodeId, ...descendants];
  }
  // Reachability from NS in the graph minus the deleted node.
  const reachable = new Set<string>([northStar.id]);
  const stack = [northStar.id];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const e of Object.values(content.edges)) {
      if (e.source === cur && e.source !== nodeId && e.target !== nodeId) {
        if (!reachable.has(e.target)) {
          reachable.add(e.target);
          stack.push(e.target);
        }
      }
    }
  }
  const toDelete = [nodeId];
  for (const id of descendants) {
    if (!reachable.has(id)) toDelete.push(id);
  }
  return toDelete;
}

/** Events for "delete subtree". */
export function deleteSubtreeEvents(content: Content, nodeId: string): MutationEvent[] {
  return removalEvents(content, subtreeToDelete(content, nodeId));
}

/** Events for "re-parent children to grandparent(s)": every (parent, child)
 *  pair gets a replacement edge preserving the child edge's type. */
export function reparentEvents(content: Content, nodeId: string): MutationEvent[] {
  const parents = Object.values(content.edges).filter((e) => e.target === nodeId);
  const childEdges = Object.values(content.edges).filter((e) => e.source === nodeId);
  const existingPairs = new Set(
    Object.values(content.edges).map((e) => `${e.source} ${e.target}`),
  );

  const events: MutationEvent[] = [];
  for (const parentEdge of parents) {
    for (const childEdge of childEdges) {
      const source = parentEdge.source;
      const target = childEdge.target;
      if (source === target) continue;
      const pair = `${source} ${target}`;
      if (existingPairs.has(pair)) continue;
      existingPairs.add(pair);
      events.push({
        id: nanoid(),
        timestamp: now(),
        type: "edge_added",
        edge: { id: nanoid(), source, target, type: childEdge.type },
      });
    }
  }
  events.push(...removalEvents(content, [nodeId]));
  return events;
}
