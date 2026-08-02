import { NextResponse } from "next/server";
import { z } from "zod";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { getTree } from "@/db/repo/trees";
import { getSettings } from "@/server/settings";
import { aiStatus } from "@/server/ai/status";
import {
  budgetExhausted,
  resetSession,
  willStartFreshSession,
} from "@/server/ai/sessions";
import { getAnalysisQueue } from "@/server/ai/analysisQueue";
import { runAgentQuery } from "@/server/ai/client";
import { createKtiToolServer } from "@/server/ai/tools/server";
import { listSuggestions } from "@/server/ai/suggestions";
import {
  appendChatMessage,
  clearChatMessages,
  listChatMessages,
  recentExchanges,
} from "@/server/ai/chat";
import { BASE_SYSTEM } from "@/server/ai/prompts/base";
import { CHAT_APPENDIX, buildChatPrompt } from "@/server/ai/prompts/chat";
import { toolLabel, type ChatToolCall } from "@/lib/ai/chat-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ treeId: string }> };

const BodySchema = z.object({ message: z.string().min(1).max(4000) });

export async function GET(_request: Request, { params }: Params) {
  const { treeId } = await params;
  if (!getTree(treeId)) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  return NextResponse.json({ messages: listChatMessages(treeId) });
}

/** Clear the transcript AND the shared SDK session — otherwise the agent would
 *  keep answering from a conversation the PM can no longer see. */
export async function DELETE(_request: Request, { params }: Params) {
  const { treeId } = await params;
  if (!getTree(treeId)) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  clearChatMessages(treeId);
  resetSession(treeId);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: Params) {
  const { treeId } = await params;
  const body = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: z.prettifyError(body.error) }, { status: 400 });
  }
  const tree = getTree(treeId);
  if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const status = aiStatus();
  if (status.status === "offline") {
    return NextResponse.json(
      { error: `AI is offline: ${status.reason ?? "unknown"}` },
      { status: 503 },
    );
  }
  if (budgetExhausted(treeId)) {
    return NextResponse.json(
      { error: "Session token budget exhausted for this tree. Raise it in Settings." },
      { status: 409 },
    );
  }

  const question = body.data.message.trim();
  // Read history BEFORE appending, so the prompt's replay excludes this turn.
  const history = willStartFreshSession(treeId) ? recentExchanges(treeId) : "";
  const userMessage = appendChatMessage(treeId, { role: "user", content: question });

  const settings = getSettings();
  const encoder = new TextEncoder();
  const flight: { q: Query | null; stopped: boolean } = { q: null, stopped: false };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          open = false;
        }
      };
      const onAbort = () => {
        flight.stopped = true;
        void flight.q?.interrupt().catch(() => {});
      };
      request.signal.addEventListener("abort", onAbort);

      send("user_message", { message: userMessage });
      send("status", { state: "queued" });

      const before = new Set(listSuggestions(treeId).map((s) => s.id));
      const toolCalls: ChatToolCall[] = [];
      const seenToolIds = new Set<string>();
      let streamed = "";

      const noteTool = (id: string, name: string) => {
        if (seenToolIds.has(id)) return;
        seenToolIds.add(id);
        const call: ChatToolCall = { id, name, label: toolLabel(name) };
        toolCalls.push(call);
        send("tool", { call });
      };

      // Serialized on the tree's queue: never two concurrent session resumes.
      const result = await getAnalysisQueue(treeId).enqueueExclusive(() => {
        send("status", { state: "thinking" });
        return runAgentQuery({
          treeId,
          prompt: buildChatPrompt({
            tree,
            question,
            ...(history ? { history } : {}),
          }),
          systemPrompt: BASE_SYSTEM + CHAT_APPENDIX,
          model: settings.models.chat,
          maxTurns: 12,
          includePartialMessages: true,
          mcpServer: createKtiToolServer(
            { treeId, cancelled: () => flight.stopped },
            { proposeSuggestion: true },
          ),
          onStarted: (q) => {
            flight.q = q;
            if (flight.stopped) void q.interrupt().catch(() => {});
          },
          onMessage: (message) => {
            if (message.type === "stream_event") {
              const event = message.event;
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                streamed += event.delta.text;
                send("delta", { text: event.delta.text });
              } else if (
                event.type === "content_block_start" &&
                event.content_block.type === "tool_use"
              ) {
                noteTool(event.content_block.id, event.content_block.name);
              }
            } else if (message.type === "assistant") {
              // Fallback for hosts that don't surface partial tool_use starts.
              for (const block of message.message.content) {
                if (block.type === "tool_use") noteTool(block.id, block.name);
              }
            }
          },
        });
      });

      request.signal.removeEventListener("abort", onAbort);

      const suggestionIds = listSuggestions(treeId)
        .filter((s) => !before.has(s.id))
        .map((s) => s.id);

      if (result.ok) {
        const content = (result.resultText || streamed).trim();
        const assistant = appendChatMessage(treeId, {
          role: "assistant",
          content:
            content ||
            (suggestionIds.length > 0
              ? "Here's what I'd add."
              : "(no answer — try rephrasing)"),
          toolCalls,
          suggestionIds,
          status: "complete",
        });
        send("done", { message: assistant });
      } else if (flight.stopped || result.kind === "interrupted") {
        const assistant = appendChatMessage(treeId, {
          role: "assistant",
          content: streamed.trim() || "(stopped)",
          toolCalls,
          suggestionIds,
          status: "interrupted",
        });
        send("done", { message: assistant });
      } else {
        const assistant = appendChatMessage(treeId, {
          role: "assistant",
          content: result.error,
          toolCalls,
          suggestionIds,
          status: "error",
        });
        send("error", { error: result.error, message: assistant });
      }

      open = false;
      try {
        controller.close();
      } catch {
        // already closed by the client disconnecting
      }
    },
    cancel() {
      flight.stopped = true;
      void flight.q?.interrupt().catch(() => {});
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
