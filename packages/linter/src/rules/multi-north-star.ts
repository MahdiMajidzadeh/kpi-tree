import type { Rule } from "../types";

export const multiNorthStar: Rule = {
  id: "MULTI_NORTH_STAR",
  severity: "error",
  title: "North Star count",
  check(index) {
    const stars = index.northStars;
    if (stars.length === 1) return [];
    if (stars.length === 0) {
      return [
        {
          message:
            "The tree has no North Star. Exactly one node must have level north_star.",
          nodeIds: [],
        },
      ];
    }
    return [
      {
        message: `The tree has ${stars.length} North Stars (${stars
          .map((n) => `"${n.title}"`)
          .join(", ")}). Exactly one is allowed — demote the others to drivers.`,
        nodeIds: stars.map((n) => n.id),
      },
    ];
  },
};
