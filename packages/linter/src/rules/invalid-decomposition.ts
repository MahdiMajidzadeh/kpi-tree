import type { Rule } from "../types";
import { tokenCoverage } from "../text";

const MULT_OPERATORS = /[×*·/÷]/;
const ADD_OPERATORS = /[+\-−–]/;

// String-level heuristic (v1 decision: formulas are free text). Deliberately
// lenient — this is a warning, not an error.
export const invalidDecomposition: Rule = {
  id: "INVALID_DECOMPOSITION",
  severity: "warning",
  title: "Invalid decomposition",
  check(index) {
    const out = [];
    for (const parent of index.nodes.values()) {
      const childEdges = index.children(parent.id);
      const mult = childEdges.filter((e) => e.type === "multiplicative");
      const add = childEdges.filter((e) => e.type === "additive");

      if (mult.length > 0 && add.length > 0) {
        out.push({
          message: `"${parent.title}" mixes multiplicative and additive children in one decomposition. A parent can be a product or a sum of its children, not both — split it or retype the edges.`,
          nodeIds: [parent.id],
          edgeIds: [...mult, ...add].map((e) => e.id),
        });
        continue;
      }

      for (const [group, operator, opName] of [
        [mult, MULT_OPERATORS, "multiplication (×)"],
        [add, ADD_OPERATORS, "addition (+)"],
      ] as const) {
        if (group.length < 2) continue;
        const formula = parent.formula;
        const hasOperator = operator.test(formula.normalize("NFKC"));
        const childTitles = group.map((e) => index.nodes.get(e.target)!.title);
        const covered = childTitles.filter(
          (t) => tokenCoverage(t, formula) >= 0.5,
        ).length;
        const enoughChildren = covered >= Math.ceil(group.length / 2);
        if (!hasOperator || !enoughChildren) {
          out.push({
            message: `"${parent.title}" declares a ${group === mult ? "multiplicative" : "additive"} decomposition, but its formula "${formula}" doesn't reflect ${opName} of its children (${childTitles.map((t) => `"${t}"`).join(", ")}). Align the formula with the decomposition or retype the edges to influence.`,
            nodeIds: [parent.id, ...group.map((e) => e.target)],
            edgeIds: group.map((e) => e.id),
          });
        }
      }
    }
    return out;
  },
};
