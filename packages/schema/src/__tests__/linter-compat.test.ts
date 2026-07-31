import { describe, expect, it } from "vitest";
import type { LinterTree } from "@kti/linter";
import { lintTree } from "@kti/linter";
import type { Tree } from "../index";

// Compile-time contract: a canonical Tree must be structurally assignable to
// the linter's input type. If the shapes drift, this file stops compiling.
type AssertAssignable<A, _B extends A> = true;
type _TreeFeedsLinter = AssertAssignable<LinterTree, Pick<Tree, "nodes" | "edges">>;

describe("@kti/schema ↔ @kti/linter contract", () => {
  it("canonical trees pass straight into lintTree", () => {
    const tree: Pick<Tree, "nodes" | "edges"> = {
      nodes: [
        {
          id: "ns",
          title: "GMV",
          formula: "Orders × AOV",
          reason: "The single number the marketplace exists to grow.",
          level: "north_star",
          direction: "increase",
          tags: [],
          origin: "user",
        },
      ],
      edges: [],
    };
    const violations = lintTree(tree);
    expect(Array.isArray(violations)).toBe(true);
  });
});
