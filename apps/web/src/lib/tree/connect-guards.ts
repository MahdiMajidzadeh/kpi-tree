import type { Edge, EdgeType, MetricNode } from "@kti/schema";

export type ConnectionVerdict = { ok: true } | { ok: false; reason: string };

/** Structural checks at drag time (edge type not yet chosen). */
export function validateConnection(
  nodes: Record<string, MetricNode>,
  edges: Record<string, Edge>,
  source: string,
  target: string,
): ConnectionVerdict {
  if (source === target) {
    return { ok: false, reason: "A metric can't drive itself." };
  }
  if (!nodes[source] || !nodes[target]) {
    return { ok: false, reason: "Both endpoints must exist." };
  }
  for (const edge of Object.values(edges)) {
    if (edge.source === source && edge.target === target) {
      return { ok: false, reason: "These metrics are already connected." };
    }
    if (edge.source === target && edge.target === source) {
      return {
        ok: false,
        reason: "These metrics are already connected in the opposite direction.",
      };
    }
  }
  // Cycle: if source is reachable from target (downward), source→target closes a loop.
  const path = findPath(edges, target, source);
  if (path) {
    const titles = [source, ...path]
      .map((id) => nodes[id]?.title ?? id)
      .join(" → ");
    return { ok: false, reason: `This would create a cycle: ${titles}.` };
  }
  return { ok: true };
}

/** Type-specific check at type-pick time (FR-2.3): a child already inside a
 *  multiplicative decomposition can't gain a second multiplicative parent —
 *  it would break both parents' formulas. */
export function validateEdgeType(
  nodes: Record<string, MetricNode>,
  edges: Record<string, Edge>,
  source: string,
  target: string,
  type: EdgeType,
): ConnectionVerdict {
  if (type !== "multiplicative") return { ok: true };
  const existing = Object.values(edges).find(
    (e) => e.target === target && e.type === "multiplicative" && e.source !== source,
  );
  if (existing) {
    const parent = nodes[existing.source]?.title ?? existing.source;
    const child = nodes[target]?.title ?? target;
    return {
      ok: false,
      reason: `"${child}" is already a multiplicative factor of "${parent}". A metric can only belong to one multiplicative decomposition — use an influence edge instead.`,
    };
  }
  return { ok: true };
}

/** BFS from `from` downward (source→target); returns the node path to `to`. */
function findPath(
  edges: Record<string, Edge>,
  from: string,
  to: string,
): string[] | null {
  const children = new Map<string, string[]>();
  for (const e of Object.values(edges)) {
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
  }
  const previous = new Map<string, string>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === to) {
      const path = [to];
      let walker = to;
      while (walker !== from) {
        walker = previous.get(walker)!;
        path.unshift(walker);
      }
      return path;
    }
    for (const next of children.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, cur);
      queue.push(next);
    }
  }
  return null;
}
