import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { bootstrap } from "./bootstrap";

export type DB = BetterSQLite3Database<typeof schema>;

// Stashed on globalThis so Next.js dev-mode HMR doesn't open a new
// connection per reload (same pattern as the SSE bus and analysis queue).
const globalStore = globalThis as unknown as {
  __ktiDb?: { db: DB; sqlite: Database.Database; path: string };
};

export function dbPath(): string {
  if (process.env.KTI_DB_PATH) return process.env.KTI_DB_PATH;
  return path.join(process.cwd(), "data", "kti.db");
}

export function getDb(): DB {
  const wanted = dbPath();
  if (globalStore.__ktiDb && globalStore.__ktiDb.path === wanted) {
    return globalStore.__ktiDb.db;
  }
  fs.mkdirSync(path.dirname(wanted), { recursive: true });
  const sqlite = new Database(wanted);
  bootstrap(sqlite);
  const db = drizzle(sqlite, { schema });
  globalStore.__ktiDb = { db, sqlite, path: wanted };
  return db;
}

/** Synchronous transaction helper (better-sqlite3 semantics). */
export function withTransaction<T>(fn: (db: DB) => T): T {
  const db = getDb();
  return db.transaction(() => fn(db)) as T;
}
