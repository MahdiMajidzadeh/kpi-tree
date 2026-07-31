import { SCHEMA_VERSION } from "./version";

/**
 * Ordered migrations: MIGRATIONS[n] upgrades a raw TreeFile payload from
 * schemaVersion n to n+1. Empty today; the discipline exists so old exports
 * keep importing as the schema evolves.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export class MigrationError extends Error {}

/** Upgrade a raw parsed-JSON TreeFile payload to the current schema version.
 *  Throws MigrationError with a readable message on unsupported versions. */
export function migrateTreeFile(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) {
    throw new MigrationError("Import is not a JSON object.");
  }
  let doc = raw as Record<string, unknown>;
  const version = doc.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(
      "Import has no valid schemaVersion field — is this a KPI Tree export?",
    );
  }
  if (version > SCHEMA_VERSION) {
    throw new MigrationError(
      `Import has schemaVersion ${version}, but this app only supports up to ${SCHEMA_VERSION}. Update the app to import this file.`,
    );
  }
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new MigrationError(
        `No migration available from schemaVersion ${v} to ${v + 1}.`,
      );
    }
    doc = { ...step(doc), schemaVersion: v + 1 };
  }
  return doc;
}
