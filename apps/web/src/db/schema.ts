import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const trees = sqliteTable("trees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  productDescription: text("product_description").notNull().default(""),
  intakeAnswers: text("intake_answers").notNull().default("{}"),
  schemaVersion: integer("schema_version").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const nodes = sqliteTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    formula: text("formula").notNull(),
    reason: text("reason").notNull(),
    level: text("level").notNull(),
    direction: text("direction").notNull(),
    timeliness: text("timeliness"),
    tags: text("tags").notNull().default("[]"),
    origin: text("origin").notNull(),
    posX: real("pos_x"),
    posY: real("pos_y"),
  },
  (t) => [index("nodes_tree_idx").on(t.treeId)],
);

export const edges = sqliteTable(
  "edges",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    target: text("target").notNull(),
    type: text("type").notNull(),
    note: text("note"),
  },
  (t) => [
    index("edges_tree_idx").on(t.treeId),
    uniqueIndex("edges_pair_idx").on(t.treeId, t.source, t.target),
  ],
);

export const mutations = sqliteTable(
  "mutations",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("mutations_tree_idx").on(t.treeId, t.seq)],
);

export const insights = sqliteTable(
  "insights",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    ruleId: text("rule_id"),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    nodeIds: text("node_ids").notNull().default("[]"),
    edgeIds: text("edge_ids").notNull().default("[]"),
    triggeringMutation: text("triggering_mutation"),
    status: text("status").notNull(),
    suggestedFix: text("suggested_fix"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
  },
  (t) => [
    index("insights_tree_status_idx").on(t.treeId, t.status),
    index("insights_tree_fp_idx").on(t.treeId, t.fingerprint),
  ],
);

export const suggestions = sqliteTable(
  "suggestions",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    payload: text("payload").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("suggestions_tree_idx").on(t.treeId)],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    treeFile: text("tree_file").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("snapshots_tree_idx").on(t.treeId)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    toolCalls: text("tool_calls").notNull().default("[]"),
    suggestionIds: text("suggestion_ids").notNull().default("[]"),
    status: text("status").notNull().default("complete"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("chat_tree_idx").on(t.treeId, t.seq)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const agentSessions = sqliteTable("agent_sessions", {
  treeId: text("tree_id")
    .primaryKey()
    .references(() => trees.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  turnCount: integer("turn_count").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  lastAnalyzedSeq: integer("last_analyzed_seq").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const generationFailures = sqliteTable(
  "generation_failures",
  {
    id: text("id").primaryKey(),
    treeId: text("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    rawOutput: text("raw_output").notNull(),
    errors: text("errors").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("genfail_tree_idx").on(t.treeId)],
);
