import fs from "node:fs";
import path from "node:path";
import type { BusinessModel } from "@kti/schema";

/** Bundled pattern library (§7.3): markdown with YAML frontmatter, one file
 *  per archetype, editable without code changes. */

const cache = new Map<string, string | null>();

function patternsDir(): string {
  return path.join(process.cwd(), "content", "patterns");
}

export function loadPattern(archetype: BusinessModel | undefined): string | null {
  if (!archetype || archetype === "other") return null;
  if (cache.has(archetype)) return cache.get(archetype)!;
  const file = path.join(patternsDir(), `${archetype}.md`);
  let body: string | null = null;
  try {
    const raw = fs.readFileSync(file, "utf-8");
    // Strip frontmatter; the model gets the prose.
    body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  } catch {
    body = null;
  }
  cache.set(archetype, body);
  return body;
}

export function availablePatterns(): string[] {
  try {
    return fs
      .readdirSync(patternsDir())
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}
