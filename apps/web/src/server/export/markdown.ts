import type { Edge, EdgeType, Tree } from "@kti/schema";

const EDGE_ANNOTATION: Record<EdgeType, string> = {
  multiplicative: "(×)",
  additive: "(+)",
  influence: "(→ influence)",
  guard: "(⛨ guard)",
};

/**
 * Indented hierarchy from the North Star, with formulas, reasons, and
 * edge-type annotations. Multi-parent nodes are expanded at first encounter
 * and referenced afterwards.
 */
export function exportMarkdown(tree: Tree): string {
  const nodesById = new Map(tree.nodes.map((n) => [n.id, n]));
  const children = new Map<string, Edge[]>();
  for (const edge of tree.edges) {
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge]);
  }

  const lines: string[] = [`# ${tree.name}`, ""];
  if (tree.productDescription.trim().length > 0) {
    lines.push(tree.productDescription.trim(), "");
  }

  const expanded = new Set<string>();

  const renderNode = (nodeId: string, depth: number, annotation: string): void => {
    const node = nodesById.get(nodeId);
    if (!node) return;
    const indent = "  ".repeat(depth);
    const badge =
      node.level === "north_star"
        ? " ⭐"
        : node.direction === "guard"
          ? " 🛡"
          : "";
    const suffix = annotation ? ` ${annotation}` : "";
    if (expanded.has(nodeId)) {
      lines.push(`${indent}- ↳ **${node.title}**${suffix} *(also drives this branch — defined above)*`);
      return;
    }
    expanded.add(nodeId);
    lines.push(`${indent}- **${node.title}**${badge}${suffix} — \`${node.formula}\``);
    if (node.reason.trim().length > 0) {
      lines.push(`${indent}  - *Why:* ${node.reason.trim()}`);
    }
    for (const edge of children.get(nodeId) ?? []) {
      renderNode(edge.target, depth + 1, EDGE_ANNOTATION[edge.type]);
    }
  };

  const northStar = tree.nodes.find((n) => n.level === "north_star");
  if (northStar) {
    renderNode(northStar.id, 0, "");
  }

  // Orphans (unreachable from the NS) still export — the file must be lossless.
  const orphans = tree.nodes.filter((n) => !expanded.has(n.id));
  if (orphans.length > 0) {
    lines.push("", "## Unconnected metrics", "");
    for (const orphan of orphans) {
      if (expanded.has(orphan.id)) continue; // already exported under another orphan
      renderNode(orphan.id, 0, "");
    }
  }

  return lines.join("\n") + "\n";
}
