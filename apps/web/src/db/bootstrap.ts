import type BetterSqlite3 from "better-sqlite3";

/**
 * Boot-time DDL. Lightweight versioning via PRAGMA user_version — bump
 * DB_VERSION and append a step when the schema changes.
 */
export const DB_VERSION = 2;

const DDL = `
CREATE TABLE IF NOT EXISTS trees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  product_description TEXT NOT NULL DEFAULT '',
  intake_answers TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  formula TEXT NOT NULL,
  reason TEXT NOT NULL,
  level TEXT NOT NULL,
  direction TEXT NOT NULL,
  timeliness TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL,
  pos_x REAL,
  pos_y REAL
);
CREATE INDEX IF NOT EXISTS nodes_tree_idx ON nodes(tree_id);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS edges_tree_idx ON edges(tree_id);
CREATE UNIQUE INDEX IF NOT EXISTS edges_pair_idx ON edges(tree_id, source, target);

CREATE TABLE IF NOT EXISTS mutations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mutations_tree_idx ON mutations(tree_id, seq);

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  rule_id TEXT,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  node_ids TEXT NOT NULL DEFAULT '[]',
  edge_ids TEXT NOT NULL DEFAULT '[]',
  triggering_mutation TEXT,
  status TEXT NOT NULL,
  suggested_fix TEXT,
  fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS insights_tree_status_idx ON insights(tree_id, status);
CREATE INDEX IF NOT EXISTS insights_tree_fp_idx ON insights(tree_id, fingerprint);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestions_tree_idx ON suggestions(tree_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tree_file TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_tree_idx ON snapshots(tree_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT NOT NULL DEFAULT '[]',
  suggestion_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'complete',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_tree_idx ON chat_messages(tree_id, seq);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  tree_id TEXT PRIMARY KEY REFERENCES trees(id) ON DELETE CASCADE,
  session_id TEXT,
  turn_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  last_analyzed_seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_failures (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  raw_output TEXT NOT NULL,
  errors TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS genfail_tree_idx ON generation_failures(tree_id);
`;

export function bootstrap(sqlite: BetterSqlite3.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const version = sqlite.pragma("user_version", { simple: true }) as number;
  if (version < DB_VERSION) {
    sqlite.exec(DDL);
    sqlite.pragma(`user_version = ${DB_VERSION}`);
  } else {
    // DDL is idempotent; run it anyway so a wiped table never breaks dev.
    sqlite.exec(DDL);
  }
}
