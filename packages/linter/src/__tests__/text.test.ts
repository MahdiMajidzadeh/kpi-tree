import { describe, expect, it } from "vitest";
import { normalizeText, titleSimilarity, tokenCoverage } from "../text";

describe("normalizeText", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeText("Checkout Conversion-Rate!")).toBe(
      "checkout conversion rate",
    );
  });

  it("folds Persian variants and removes ZWNJ", () => {
    expect(normalizeText("چک‌اوت")).toBe(normalizeText("چکاوت"));
    expect(normalizeText("تبديل")).toBe(normalizeText("تبدیل"));
  });
});

describe("titleSimilarity", () => {
  it("returns 1 for identical-after-normalization titles", () => {
    expect(titleSimilarity("Orders", "orders")).toBe(1);
  });

  it("is high for near-duplicates", () => {
    expect(
      titleSimilarity("Checkout Conversion Rate", "Conversion Rate (Checkout)"),
    ).toBeGreaterThanOrEqual(0.85);
  });

  it("is low for distinct metrics", () => {
    expect(titleSimilarity("Sessions", "Average Order Value")).toBeLessThan(0.5);
  });
});

describe("tokenCoverage", () => {
  it("measures how much of a title appears in a formula", () => {
    expect(tokenCoverage("Orders", "Orders × AOV")).toBe(1);
    expect(tokenCoverage("Checkout Sessions", "Completed Orders / Checkout Sessions")).toBe(1);
    expect(tokenCoverage("Retention", "Orders × AOV")).toBe(0);
  });
});
