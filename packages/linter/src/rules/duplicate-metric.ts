import type { Rule } from "../types";
import { normalizeText } from "../text";

const THRESHOLD = 0.85;

interface Prepared {
  id: string;
  title: string;
  norm: string;
  tokens: Set<string>;
  bigrams: Map<string, number>;
  bigramCount: number;
}

function prepare(id: string, title: string): Prepared {
  const norm = normalizeText(title);
  const tokens = new Set(norm.length === 0 ? [] : norm.split(" "));
  const compact = norm.replace(/ /g, "");
  const bigrams = new Map<string, number>();
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
  }
  return { id, title, norm, tokens, bigrams, bigramCount: Math.max(compact.length - 1, 0) };
}

function similarity(a: Prepared, b: Prepared): number {
  if (a.norm === b.norm) return 1;

  // Upper bounds let us skip most pairs without touching the sets.
  const jaccardBound =
    Math.min(a.tokens.size, b.tokens.size) / Math.max(a.tokens.size, b.tokens.size, 1);
  const diceBound =
    (2 * Math.min(a.bigramCount, b.bigramCount)) /
    Math.max(a.bigramCount + b.bigramCount, 1);
  if (jaccardBound < THRESHOLD && diceBound < THRESHOLD) return 0;

  let intersection = 0;
  for (const t of a.tokens) if (b.tokens.has(t)) intersection++;
  const jaccard =
    a.tokens.size + b.tokens.size === 0
      ? 1
      : intersection / (a.tokens.size + b.tokens.size - intersection);
  if (jaccard >= THRESHOLD) return jaccard;

  if (a.bigramCount === 0 || b.bigramCount === 0) return jaccard;
  let overlap = 0;
  const [small, large] = a.bigrams.size <= b.bigrams.size ? [a, b] : [b, a];
  for (const [g, c] of small.bigrams) {
    const other = large.bigrams.get(g);
    if (other !== undefined) overlap += Math.min(c, other);
  }
  const dice = (2 * overlap) / (a.bigramCount + b.bigramCount);
  return Math.max(jaccard, dice);
}

export const duplicateMetric: Rule = {
  id: "DUPLICATE_METRIC",
  severity: "warning",
  title: "Duplicate metric",
  check(index) {
    const prepared = [...index.nodes.values()].map((n) => prepare(n.id, n.title));
    const out = [];
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const a = prepared[i]!;
        const b = prepared[j]!;
        const s = similarity(a, b);
        if (s >= THRESHOLD) {
          out.push({
            message: `"${a.title}" and "${b.title}" look like the same metric (${Math.round(s * 100)}% title similarity). Merge them or rename one to make the distinction explicit.`,
            nodeIds: [a.id, b.id],
          });
        }
      }
    }
    return out;
  },
};
