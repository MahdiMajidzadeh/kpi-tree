import { z } from "zod";
import { DirectionSchema, TimelinessSchema } from "./node";
import { EdgeTypeSchema } from "./edge";

export const SuggestionStatusSchema = z.enum(["proposed", "accepted", "rejected"]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

// A complete node candidate (FR-4.2): accepting one requires zero manual wiring.
export const SuggestionSchema = z.object({
  id: z.string().min(1),
  treeId: z.string().min(1),
  title: z.string().min(1),
  formula: z.string().min(1),
  reason: z.string().min(1),
  level: z.enum(["driver", "input"]),
  direction: DirectionSchema,
  timeliness: TimelinessSchema.optional(),
  parentNodeId: z.string().min(1),
  edgeType: EdgeTypeSchema,
  status: SuggestionStatusSchema,
  createdAt: z.number(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;
