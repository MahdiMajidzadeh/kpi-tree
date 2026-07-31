import type { Tree } from "@kti/schema";

function label(title: string): string {
  // Quoted labels are safe for Persian, spaces, and most punctuation.
  return `"${title.replace(/"/g, "'")}"`;
}

export function exportMermaid(tree: Tree): string {
  const lines: string[] = ["flowchart TD"];

  for (const node of tree.nodes) {
    lines.push(`  ${node.id}[${label(node.title)}]`);
  }

  const guardLinks: number[] = [];
  const influenceLinks: number[] = [];
  tree.edges.forEach((edge, i) => {
    switch (edge.type) {
      case "multiplicative":
        lines.push(`  ${edge.source} -->|×| ${edge.target}`);
        break;
      case "additive":
        lines.push(`  ${edge.source} -->|+| ${edge.target}`);
        break;
      case "influence":
        lines.push(`  ${edge.source} -.-> ${edge.target}`);
        influenceLinks.push(i);
        break;
      case "guard":
        lines.push(`  ${edge.source} -.->|guard| ${edge.target}`);
        guardLinks.push(i);
        break;
    }
  });

  const northStar = tree.nodes.find((n) => n.level === "north_star");
  const guards = tree.nodes.filter((n) => n.direction === "guard");
  lines.push("  classDef northStar fill:#4f46e5,color:#fff,stroke:#312e81,stroke-width:2px;");
  lines.push("  classDef guardNode fill:#fef3c7,stroke:#d97706,color:#78350f;");
  if (northStar) lines.push(`  class ${northStar.id} northStar;`);
  if (guards.length > 0)
    lines.push(`  class ${guards.map((g) => g.id).join(",")} guardNode;`);
  if (guardLinks.length > 0)
    lines.push(`  linkStyle ${guardLinks.join(",")} stroke:#d97706,stroke-dasharray:2 4;`);

  return lines.join("\n") + "\n";
}
