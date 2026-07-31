import { z } from "zod";

/** What the model returns for tree generation (FR-1.2). Ids are model-local
 *  ("n1", "n2", …) and remapped to nanoids at persist time. */
export const GeneratedNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  formula: z.string().min(1),
  reason: z.string().min(1),
  level: z.enum(["north_star", "driver", "input"]),
  direction: z.enum(["increase", "decrease", "guard"]),
  timeliness: z.enum(["leading", "lagging"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const GeneratedEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(["multiplicative", "additive", "influence", "guard"]),
  note: z.string().optional(),
});

export const GeneratedTreeSchema = z.object({
  treeName: z.string().min(1),
  nodes: z.array(GeneratedNodeSchema).min(12).max(30),
  edges: z.array(GeneratedEdgeSchema).min(1),
});
export type GeneratedTree = z.infer<typeof GeneratedTreeSchema>;

export const NorthStarCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(1),
        formula: z.string().min(1),
        tradeoffs: z.string().min(1),
      }),
    )
    .min(2)
    .max(3),
});
export type NorthStarCandidates = z.infer<typeof NorthStarCandidatesSchema>;

export function toDraft7(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}
