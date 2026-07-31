// Text utilities for title similarity and formula heuristics.
// Persian-aware: NFKC folds Arabic presentation forms; ZWNJ (U+200C) joins
// word halves for comparison purposes; Arabic/Persian letter variants folded.

const PUNCTUATION = /[!-/:-@[-`{-~؛؟،٪«»_]/g;
const DIACRITICS = /[ً-ٰٟ]/g;

export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/‌/g, "") // ZWNJ: join Persian word halves
    .replace(DIACRITICS, "")
    .replace(/[يى]/g, "ی") // Arabic yeh variants → Persian yeh
    .replace(/ك/g, "ک") // Arabic kaf → Persian kaf
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function bigrams(s: string): Map<string, number> {
  const grams = new Map<string, number>();
  const compact = s.replace(/ /g, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

export function diceBigram(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  for (const c of ga.values()) sizeA += c;
  for (const c of gb.values()) sizeB += c;
  if (sizeA === 0 && sizeB === 0) return 1;
  if (sizeA === 0 || sizeB === 0) return 0;
  let overlap = 0;
  for (const [g, c] of ga) {
    const other = gb.get(g);
    if (other !== undefined) overlap += Math.min(c, other);
  }
  return (2 * overlap) / (sizeA + sizeB);
}

/** Similarity of two titles in [0, 1]: max of token Jaccard and bigram Dice. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  return Math.max(jaccard(na.split(" "), nb.split(" ")), diceBigram(na, nb));
}

/** Fraction of `needle` tokens present in `haystack` tokens. */
export function tokenCoverage(needle: string, haystack: string): number {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return 0;
  const hay = new Set(tokenize(haystack));
  let hit = 0;
  for (const t of needleTokens) if (hay.has(t)) hit++;
  return hit / needleTokens.length;
}
