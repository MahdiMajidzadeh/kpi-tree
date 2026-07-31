import { z } from "zod";

export const LevelSchema = z.enum(["north_star", "driver", "input"]);
export type Level = z.infer<typeof LevelSchema>;

export const DirectionSchema = z.enum(["increase", "decrease", "guard"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const TimelinessSchema = z.enum(["leading", "lagging"]);
export type Timeliness = z.infer<typeof TimelinessSchema>;

export const OriginSchema = z.enum(["generated", "user", "suggested_accepted"]);
export type Origin = z.infer<typeof OriginSchema>;

export const PositionSchema = z.object({ x: z.number(), y: z.number() });
export type Position = z.infer<typeof PositionSchema>;

export const NodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  formula: z.string().min(1),
  reason: z.string(),
  level: LevelSchema,
  direction: DirectionSchema,
  timeliness: TimelinessSchema.optional(),
  tags: z.array(z.string()).default([]),
  origin: OriginSchema,
  // Presentation metadata: canvas position survives export/import.
  position: PositionSchema.optional(),
});
export type MetricNode = z.infer<typeof NodeSchema>;

// Partial node fields for node_modified events and suggested-fix patches.
// `timeliness: null` clears the field.
export const NodePatchSchema = z.object({
  title: z.string().min(1).optional(),
  formula: z.string().min(1).optional(),
  reason: z.string().optional(),
  level: LevelSchema.optional(),
  direction: DirectionSchema.optional(),
  timeliness: TimelinessSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  position: PositionSchema.optional(),
});
export type NodePatch = z.infer<typeof NodePatchSchema>;

// A node candidate without identity/origin — used by suggestions and
// suggested-fix add_node ops; the app assigns id/origin at apply time.
export const NodeDraftSchema = z.object({
  title: z.string().min(1),
  formula: z.string().min(1),
  reason: z.string().min(1),
  level: z.enum(["driver", "input"]),
  direction: DirectionSchema,
  timeliness: TimelinessSchema.optional(),
  tags: z.array(z.string()).default([]),
});
export type NodeDraft = z.infer<typeof NodeDraftSchema>;
