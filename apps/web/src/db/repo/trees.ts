import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  SCHEMA_VERSION,
  type Edge,
  type IntakeAnswers,
  type MetricNode,
  type Tree,
} from "@kti/schema";
import { getDb, type DB } from "../client";
import { edges, insights, nodes, trees } from "../schema";

export function rowToNode(row: typeof nodes.$inferSelect): MetricNode {
  return {
    id: row.id,
    title: row.title,
    formula: row.formula,
    reason: row.reason,
    level: row.level as MetricNode["level"],
    direction: row.direction as MetricNode["direction"],
    ...(row.timeliness
      ? { timeliness: row.timeliness as NonNullable<MetricNode["timeliness"]> }
      : {}),
    tags: JSON.parse(row.tags) as string[],
    origin: row.origin as MetricNode["origin"],
    ...(row.posX !== null && row.posY !== null
      ? { position: { x: row.posX, y: row.posY } }
      : {}),
  };
}

export function rowToEdge(row: typeof edges.$inferSelect): Edge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    type: row.type as Edge["type"],
    ...(row.note ? { note: row.note } : {}),
  };
}

export function nodeToRow(treeId: string, node: MetricNode) {
  return {
    id: node.id,
    treeId,
    title: node.title,
    formula: node.formula,
    reason: node.reason,
    level: node.level,
    direction: node.direction,
    timeliness: node.timeliness ?? null,
    tags: JSON.stringify(node.tags ?? []),
    origin: node.origin,
    posX: node.position?.x ?? null,
    posY: node.position?.y ?? null,
  };
}

export function edgeToRow(treeId: string, edge: Edge) {
  return {
    id: edge.id,
    treeId,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    note: edge.note ?? null,
  };
}

export function getTree(id: string, db: DB = getDb()): Tree | null {
  const row = db.select().from(trees).where(eq(trees.id, id)).get();
  if (!row) return null;
  const nodeRows = db.select().from(nodes).where(eq(nodes.treeId, id)).all();
  const edgeRows = db.select().from(edges).where(eq(edges.treeId, id)).all();
  return {
    id: row.id,
    name: row.name,
    productDescription: row.productDescription,
    intakeAnswers: JSON.parse(row.intakeAnswers) as IntakeAnswers,
    nodes: nodeRows.map(rowToNode),
    edges: edgeRows.map(rowToEdge),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    schemaVersion: row.schemaVersion,
  };
}

export interface TreeListItem {
  id: string;
  name: string;
  nodeCount: number;
  errorCount: number;
  warningCount: number;
  updatedAt: number;
  createdAt: number;
}

export function listTrees(db: DB = getDb()): TreeListItem[] {
  const rows = db
    .select({
      id: trees.id,
      name: trees.name,
      updatedAt: trees.updatedAt,
      createdAt: trees.createdAt,
    })
    .from(trees)
    .orderBy(desc(trees.updatedAt))
    .all();

  const nodeCounts = new Map(
    db
      .select({ treeId: nodes.treeId, count: sql<number>`count(*)` })
      .from(nodes)
      .groupBy(nodes.treeId)
      .all()
      .map((r) => [r.treeId, r.count]),
  );
  const severityCounts = db
    .select({
      treeId: insights.treeId,
      severity: insights.severity,
      count: sql<number>`count(*)`,
    })
    .from(insights)
    .where(eq(insights.status, "active"))
    .groupBy(insights.treeId, insights.severity)
    .all();
  const errors = new Map<string, number>();
  const warnings = new Map<string, number>();
  for (const row of severityCounts) {
    if (row.severity === "error") errors.set(row.treeId, row.count);
    if (row.severity === "warning") warnings.set(row.treeId, row.count);
  }

  return rows.map((row) => ({
    ...row,
    nodeCount: nodeCounts.get(row.id) ?? 0,
    errorCount: errors.get(row.id) ?? 0,
    warningCount: warnings.get(row.id) ?? 0,
  }));
}

export interface CreateTreeInput {
  name: string;
  productDescription?: string;
  intakeAnswers?: IntakeAnswers;
  nodes?: MetricNode[];
  edges?: Edge[];
}

export function createTree(input: CreateTreeInput, db: DB = getDb()): Tree {
  const now = Date.now();
  const id = nanoid();
  db.insert(trees)
    .values({
      id,
      name: input.name,
      productDescription: input.productDescription ?? "",
      intakeAnswers: JSON.stringify(input.intakeAnswers ?? {}),
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  for (const node of input.nodes ?? []) {
    db.insert(nodes).values(nodeToRow(id, node)).run();
  }
  for (const edge of input.edges ?? []) {
    db.insert(edges).values(edgeToRow(id, edge)).run();
  }
  return getTree(id, db)!;
}

export function renameTree(id: string, name: string, db: DB = getDb()): boolean {
  const result = db
    .update(trees)
    .set({ name, updatedAt: Date.now() })
    .where(eq(trees.id, id))
    .run();
  return result.changes > 0;
}

export function deleteTree(id: string, db: DB = getDb()): boolean {
  const result = db.delete(trees).where(eq(trees.id, id)).run();
  return result.changes > 0;
}

/** Deep copy with fresh ids (nodes, edges remapped). */
export function duplicateTree(id: string, db: DB = getDb()): Tree | null {
  const source = getTree(id, db);
  if (!source) return null;
  const idMap = new Map<string, string>();
  const newNodes = source.nodes.map((n) => {
    const newId = nanoid();
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });
  const newEdges = source.edges.map((e) => ({
    ...e,
    id: nanoid(),
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
  }));
  return createTree(
    {
      name: `${source.name} (copy)`,
      productDescription: source.productDescription,
      intakeAnswers: source.intakeAnswers,
      nodes: newNodes,
      edges: newEdges,
    },
    db,
  );
}

/** Replace a tree's node/edge rows with the given content (inside a txn). */
export function replaceTreeContent(
  treeId: string,
  content: { nodes: MetricNode[]; edges: Edge[] },
  db: DB,
): void {
  db.delete(edges).where(eq(edges.treeId, treeId)).run();
  db.delete(nodes).where(eq(nodes.treeId, treeId)).run();
  for (const node of content.nodes) {
    db.insert(nodes).values(nodeToRow(treeId, node)).run();
  }
  for (const edge of content.edges) {
    db.insert(edges).values(edgeToRow(treeId, edge)).run();
  }
  db.update(trees)
    .set({ updatedAt: Date.now() })
    .where(and(eq(trees.id, treeId)))
    .run();
}
