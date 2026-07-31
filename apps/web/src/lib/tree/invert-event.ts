import { nanoid } from "nanoid";
import type { MutationEvent } from "@kti/schema";

/** Inverse of a single event. Payloads already carry the "before" state. */
export function invertEvent(event: MutationEvent): MutationEvent {
  const base = { id: nanoid(), timestamp: Date.now() };
  switch (event.type) {
    case "node_added":
      return { ...base, type: "node_removed", node: event.node, removedEdges: [] };
    case "node_removed":
      // Restore order (node first, then its edges) is handled by invertEvents.
      return { ...base, type: "node_added", node: event.node };
    case "node_modified":
      return {
        ...base,
        type: "node_modified",
        nodeId: event.nodeId,
        before: event.after,
        after: event.before,
      };
    case "edge_added":
      return { ...base, type: "edge_removed", edge: event.edge };
    case "edge_removed":
      return { ...base, type: "edge_added", edge: event.edge };
    case "edge_retyped":
      return {
        ...base,
        type: "edge_retyped",
        edgeId: event.edgeId,
        before: event.after,
        after: event.before,
      };
  }
}

/** Inverse of an event batch: each event inverted, in reverse order.
 *  node_removed additionally re-adds its removed edges. */
export function invertEvents(events: MutationEvent[]): MutationEvent[] {
  const out: MutationEvent[] = [];
  for (const event of [...events].reverse()) {
    out.push(invertEvent(event));
    if (event.type === "node_removed") {
      for (const edge of event.removedEdges) {
        out.push({ id: nanoid(), timestamp: Date.now(), type: "edge_added", edge });
      }
    }
  }
  return out;
}
