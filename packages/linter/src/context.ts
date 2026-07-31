import type { LinterEdge, LinterNode, LinterTree } from "./types";

/**
 * Indexed view of a tree, built once per lint run and shared by all rules.
 * Edge direction: source = parent, target = child (driver).
 */
export class TreeIndex {
  readonly nodes: Map<string, LinterNode> = new Map();
  readonly edges: Map<string, LinterEdge> = new Map();
  /** Outgoing edges by source id (edges to a node's children/drivers). */
  readonly childEdges: Map<string, LinterEdge[]> = new Map();
  /** Incoming edges by target id (edges from a node's parents). */
  readonly parentEdges: Map<string, LinterEdge[]> = new Map();
  readonly northStars: LinterNode[] = [];
  /** Nodes reachable from the North Star (only meaningful when exactly one NS). */
  readonly reachable: Set<string> = new Set();
  /** BFS depth from the North Star (NS = 0); only reachable nodes appear. */
  readonly depth: Map<string, number> = new Map();
  /** Nodes participating in a cycle (Kahn's leftovers). */
  readonly cycleNodes: Set<string> = new Set();

  constructor(readonly tree: LinterTree) {
    for (const n of tree.nodes) {
      this.nodes.set(n.id, n);
      if (n.level === "north_star") this.northStars.push(n);
    }
    for (const e of tree.edges) {
      if (!this.nodes.has(e.source) || !this.nodes.has(e.target)) continue;
      this.edges.set(e.id, e);
      push(this.childEdges, e.source, e);
      push(this.parentEdges, e.target, e);
    }
    this.computeReachability();
    this.computeCycles();
  }

  children(id: string): LinterEdge[] {
    return this.childEdges.get(id) ?? [];
  }

  parents(id: string): LinterEdge[] {
    return this.parentEdges.get(id) ?? [];
  }

  isLeaf(id: string): boolean {
    return this.children(id).length === 0;
  }

  /** All descendants of a node (children direction), excluding the node itself. */
  descendants(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = this.children(id).map((e) => e.target);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const e of this.children(cur)) stack.push(e.target);
    }
    return seen;
  }

  /** Max depth of a node's subtree relative to the node itself (0 = leaf). */
  subtreeHeight(id: string): number {
    const memo = new Map<string, number>();
    const visit = (cur: string, guard: Set<string>): number => {
      const cached = memo.get(cur);
      if (cached !== undefined) return cached;
      if (guard.has(cur)) return 0; // cycle guard; CYCLE rule reports it
      guard.add(cur);
      let h = 0;
      for (const e of this.children(cur)) {
        h = Math.max(h, 1 + visit(e.target, guard));
      }
      guard.delete(cur);
      memo.set(cur, h);
      return h;
    };
    return visit(id, new Set());
  }

  private computeReachability(): void {
    if (this.northStars.length !== 1) return;
    const root = this.northStars[0]!.id;
    this.reachable.add(root);
    this.depth.set(root, 0);
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = this.depth.get(cur)!;
      for (const e of this.children(cur)) {
        if (this.reachable.has(e.target)) continue;
        this.reachable.add(e.target);
        this.depth.set(e.target, d + 1);
        queue.push(e.target);
      }
    }
  }

  private computeCycles(): void {
    const indegree = new Map<string, number>();
    for (const id of this.nodes.keys()) indegree.set(id, 0);
    for (const e of this.edges.values()) {
      if (e.source === e.target) {
        this.cycleNodes.add(e.source);
        continue;
      }
      indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    }
    const queue = [...indegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id);
    let visited = 0;
    while (queue.length > 0) {
      const id = queue.pop()!;
      visited++;
      for (const e of this.children(id)) {
        if (e.source === e.target) continue;
        const d = indegree.get(e.target)! - 1;
        indegree.set(e.target, d);
        if (d === 0) queue.push(e.target);
      }
    }
    if (visited < this.nodes.size) {
      for (const [id, d] of indegree) {
        if (d > 0) this.cycleNodes.add(id);
      }
    }
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
