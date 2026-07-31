import { SCHEMA_VERSION, type Tree, type TreeFile } from "@kti/schema";

export function exportTreeFile(tree: Tree): TreeFile {
  return { schemaVersion: SCHEMA_VERSION, tree };
}

export function treeFileJson(tree: Tree): string {
  return JSON.stringify(exportTreeFile(tree), null, 2);
}
