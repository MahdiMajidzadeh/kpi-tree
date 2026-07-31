import type {
  LinterDirection,
  LinterEdge,
  LinterEdgeType,
  LinterLevel,
  LinterNode,
  LinterTree,
} from "../types";

interface NodeOpts {
  level?: LinterLevel;
  direction?: LinterDirection;
  timeliness?: "leading" | "lagging";
  tags?: string[];
  formula?: string;
  reason?: string;
}

/** Tiny builder DSL for linter fixtures. */
export class TreeBuilder {
  private nodes: LinterNode[] = [];
  private edges: LinterEdge[] = [];
  private edgeCounter = 0;

  node(id: string, title: string, opts: NodeOpts = {}): this {
    this.nodes.push({
      id,
      title,
      formula: opts.formula ?? `Count of ${title}`,
      reason: opts.reason ?? `This metric matters because it captures ${title}.`,
      level: opts.level ?? "driver",
      direction: opts.direction ?? "increase",
      ...(opts.timeliness ? { timeliness: opts.timeliness } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
    });
    return this;
  }

  northStar(id: string, title: string, opts: Omit<NodeOpts, "level"> = {}): this {
    return this.node(id, title, { ...opts, level: "north_star" });
  }

  leaf(id: string, title: string, opts: Omit<NodeOpts, "level"> = {}): this {
    return this.node(id, title, { ...opts, level: "input" });
  }

  edge(source: string, target: string, type: LinterEdgeType = "influence"): this {
    this.edges.push({ id: `e${this.edgeCounter++}_${source}_${target}`, source, target, type });
    return this;
  }

  build(): LinterTree {
    return { nodes: this.nodes, edges: this.edges };
  }
}

export function t(): TreeBuilder {
  return new TreeBuilder();
}

/** A small clean tree that should produce zero violations. */
export function cleanTree(): LinterTree {
  return t()
    .northStar("ns", "GMV", { formula: "Orders × AOV" })
    .node("orders", "Orders", {
      formula: "Sessions × Conversion",
      direction: "increase",
      timeliness: "lagging",
    })
    .leaf("aov", "AOV", { formula: "GMV / Orders count", timeliness: "lagging" })
    .leaf("sessions", "Sessions", {
      formula: "Count of sessions",
      timeliness: "leading",
    })
    .leaf("cvr", "Conversion", {
      formula: "Orders count / Sessions count",
      timeliness: "leading",
    })
    .leaf("quality", "Return Quality", {
      direction: "guard",
      formula: "Count of returned items / Count of items",
      timeliness: "leading",
    })
    .edge("ns", "orders", "multiplicative")
    .edge("ns", "aov", "multiplicative")
    .edge("orders", "sessions", "multiplicative")
    .edge("orders", "cvr", "multiplicative")
    .edge("orders", "quality", "guard")
    .build();
}
