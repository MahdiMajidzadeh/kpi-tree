import { z } from "zod";
import { NodeDraftSchema, NodePatchSchema } from "./node";
import { EdgeTypeSchema } from "./edge";

export const InsightSourceSchema = z.enum(["rule", "agent"]);
export type InsightSource = z.infer<typeof InsightSourceSchema>;

export const SeveritySchema = z.enum(["error", "warning", "info", "praise"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const InsightStatusSchema = z.enum(["active", "dismissed", "resolved"]);
export type InsightStatus = z.infer<typeof InsightStatusSchema>;

// Machine-applicable patch ops, replayed through the normal mutation
// pipeline so undo/linter/analysis all observe an applied fix.
export const SuggestedFixOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_node"),
    node: NodeDraftSchema,
    parentId: z.string().min(1),
    edgeType: EdgeTypeSchema,
  }),
  z.object({
    op: z.literal("add_edge"),
    source: z.string().min(1),
    target: z.string().min(1),
    type: EdgeTypeSchema,
    note: z.string().optional(),
  }),
  z.object({
    op: z.literal("update_node"),
    nodeId: z.string().min(1),
    fields: NodePatchSchema,
  }),
  z.object({ op: z.literal("remove_edge"), edgeId: z.string().min(1) }),
  z.object({
    op: z.literal("retype_edge"),
    edgeId: z.string().min(1),
    type: EdgeTypeSchema,
  }),
]);
export type SuggestedFixOp = z.infer<typeof SuggestedFixOpSchema>;

export const SuggestedFixSchema = z.object({
  description: z.string().min(1),
  ops: z.array(SuggestedFixOpSchema).min(1),
});
export type SuggestedFix = z.infer<typeof SuggestedFixSchema>;

export const InsightSchema = z.object({
  id: z.string().min(1),
  treeId: z.string().min(1),
  source: InsightSourceSchema,
  ruleId: z.string().optional(),
  severity: SeveritySchema,
  title: z.string().min(1),
  body: z.string(),
  nodeIds: z.array(z.string()).default([]),
  edgeIds: z.array(z.string()).default([]),
  triggeringMutation: z.unknown().optional(),
  status: InsightStatusSchema,
  suggestedFix: SuggestedFixSchema.optional(),
  // Stable identity of the underlying condition; drives auto-resolve and
  // "dismissed insights don't reappear".
  fingerprint: z.string().min(1),
  createdAt: z.number(),
  resolvedAt: z.number().optional(),
});
export type Insight = z.infer<typeof InsightSchema>;
