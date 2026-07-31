import { z } from "zod";
import { NodeSchema, NodePatchSchema } from "./node";
import { EdgeSchema, EdgeTypeSchema } from "./edge";

const base = {
  id: z.string().min(1),
  timestamp: z.number(),
};

// Every payload carries enough to invert the event (undo) and to replay it
// (server-side apply): node_removed includes the node and its incident edges,
// node_modified carries before/after patches.
export const MutationEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("node_added"), node: NodeSchema }),
  z.object({
    ...base,
    type: z.literal("node_removed"),
    node: NodeSchema,
    removedEdges: z.array(EdgeSchema),
  }),
  z.object({
    ...base,
    type: z.literal("node_modified"),
    nodeId: z.string().min(1),
    before: NodePatchSchema,
    after: NodePatchSchema,
  }),
  z.object({ ...base, type: z.literal("edge_added"), edge: EdgeSchema }),
  z.object({ ...base, type: z.literal("edge_removed"), edge: EdgeSchema }),
  z.object({
    ...base,
    type: z.literal("edge_retyped"),
    edgeId: z.string().min(1),
    before: EdgeTypeSchema,
    after: EdgeTypeSchema,
  }),
]);
export type MutationEvent = z.infer<typeof MutationEventSchema>;
export type MutationType = MutationEvent["type"];

export const MutationBatchSchema = z.object({
  events: z.array(MutationEventSchema).min(1),
});
export type MutationBatch = z.infer<typeof MutationBatchSchema>;
