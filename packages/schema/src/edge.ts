import { z } from "zod";

export const EdgeTypeSchema = z.enum([
  "multiplicative",
  "additive",
  "influence",
  "guard",
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

// source = parent (higher-level metric), target = child (driver).
export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: EdgeTypeSchema,
  note: z.string().optional(),
});
export type Edge = z.infer<typeof EdgeSchema>;
