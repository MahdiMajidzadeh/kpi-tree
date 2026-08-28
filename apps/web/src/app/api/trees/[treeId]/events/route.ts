import { getSessionRow } from "@/server/ai/sessions";
import { subscribe, type TreeEvent } from "@/server/events";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

/** One SSE stream per open tree (§6): named events, 25s heartbeat. */
export async function GET(request: Request, { params }: Params) {
  const { treeId } = await params;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: TreeEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      };
      controller.enqueue(encoder.encode(`: connected\n\n`));
      unsubscribe = subscribe(treeId, send);
      // Seed the usage meter with persisted spend so it shows on page load,
      // not only after the next AI call publishes an update.
      const row = getSessionRow(treeId);
      send({
        type: "usage_update",
        tokensUsed: row.tokensUsed,
        budget: getSettings().sessionTokenBudget,
        costUsd: row.costUsd,
      });
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // closed
        }
      }, 25_000);
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
