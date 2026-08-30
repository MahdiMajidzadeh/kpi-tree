"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ChatMessage, ChatToolCall } from "@/lib/ai/chat-types";
import { useEditor, type EditorState } from "@/stores/tree-editor-store";
import { SuggestionCard } from "@/components/panels/SuggestionCard";

const STARTERS = [
  "Is this tree missing anything important?",
  "Why is this decomposition multiplicative?",
  "I need a metric for repeat purchase",
];

function ToolChips({ calls, live }: { calls: ChatToolCall[]; live?: boolean }) {
  if (calls.length === 0) return null;
  // Repeated calls to the same tool collapse into one chip with a count.
  const grouped = calls.reduce<{ label: string; count: number }[]>((acc, call) => {
    const last = acc[acc.length - 1];
    if (last && last.label === call.label) last.count += 1;
    else acc.push({ label: call.label, count: 1 });
    return acc;
  }, []);
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {grouped.map((chip, index) => (
        <span
          key={`${chip.label}-${index}`}
          className={`rounded-full bg-slate-100 px-1.5 py-px text-[11px] text-slate-500 ${
            live && index === grouped.length - 1 ? "animate-pulse" : ""
          }`}
        >
          {chip.label}
          {chip.count > 1 ? ` ×${chip.count}` : ""}
        </span>
      ))}
    </div>
  );
}

/** Plain-text rendering with "-" bullets promoted to a list — the agent is
 *  instructed not to emit markdown, so a full parser would be overkill. */
function MessageBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <>
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const bullets = lines.every((line) => /^\s*[-•*]\s+/.test(line));
        if (bullets) {
          return (
            <ul key={index} className="ms-3 list-disc space-y-0.5 [&:not(:first-child)]:mt-1.5">
              {lines.map((line, i) => (
                <li key={i} dir="auto" className="bidi-plaintext">
                  {line.replace(/^\s*[-•*]\s+/, "")}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={index}
            dir="auto"
            className="bidi-plaintext whitespace-pre-wrap [&:not(:first-child)]:mt-1.5"
          >
            {block}
          </p>
        );
      })}
    </>
  );
}

function MessageBubble({
  message,
  store,
}: {
  message: ChatMessage;
  store: StoreApi<EditorState>;
}) {
  const suggestions = useEditor(store, (s) => s.suggestions);
  const mine = suggestions.filter(
    (s) => message.suggestionIds.includes(s.id) && s.status === "proposed",
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          dir="auto"
          className="bidi-plaintext max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-indigo-600 px-2.5 py-1.5 text-xs leading-snug text-white"
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ToolChips calls={message.toolCalls} />
      <div
        className={`rounded-lg rounded-bl-sm px-2.5 py-1.5 text-xs leading-snug ${
          message.status === "error"
            ? "bg-red-50 text-red-700"
            : "bg-slate-100 text-slate-700"
        }`}
      >
        <MessageBody text={message.content} />
        {message.status === "interrupted" && (
          <span className="mt-1 block text-[11px] italic text-slate-500">stopped</span>
        )}
      </div>
      {mine.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {mine.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ store }: { store: StoreApi<EditorState> }) {
  const messages = useEditor(store, (s) => s.chatMessages);
  const draft = useEditor(store, (s) => s.chatDraft);
  const analysisState = useEditor(store, (s) => s.analysisState);
  // Inline cards land after the message that announced them; scroll on both.
  const suggestionCount = useEditor(store, (s) => s.suggestions.length);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void store.getState().loadChat();
  }, [store]);

  // Pin to the bottom as tokens arrive, unless the PM scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, draft, suggestionCount]);

  const blocked =
    analysisState === "offline"
      ? "AI is offline — check your API key in Settings."
      : analysisState === "budget_exhausted"
        ? "Session token budget exhausted. Raise it in Settings."
        : null;

  const send = (text: string) => {
    if (!text.trim() || draft) return;
    setInput("");
    void store.getState().sendChatMessage(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2 pt-1">
        {messages.length === 0 && !draft && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs leading-snug text-slate-500">
              Ask about this tree, or describe a metric you need — accepted
              suggestions drop straight onto the canvas.
            </p>
            {STARTERS.map((starter) => (
              <button
                key={starter}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-start text-[11px] text-slate-500 hover:border-indigo-300 hover:text-indigo-700"
                onClick={() => send(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} store={store} />
        ))}

        {draft && (
          <div>
            <ToolChips calls={draft.toolCalls} live />
            <div className="rounded-lg rounded-bl-sm bg-slate-100 px-2.5 py-1.5 text-xs leading-snug text-slate-700">
              {draft.text ? (
                <MessageBody text={draft.text} />
              ) : (
                <span className="animate-pulse text-slate-500">
                  {draft.state === "queued" ? "Waiting for the analyzer…" : "Thinking…"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-2">
        {blocked && <p className="mb-1.5 text-[11px] text-amber-700">{blocked}</p>}
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            dir="auto"
            rows={2}
            value={input}
            placeholder="Ask a question or describe a metric…"
            className="bidi-plaintext min-h-[38px] flex-1 resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-xs leading-snug focus:border-indigo-400"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {draft ? (
            <button
              className="shrink-0 rounded-lg bg-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-300"
              title="Stop the agent"
              aria-label="Stop the agent"
              onClick={() => store.getState().stopChat()}
            >
              ■
            </button>
          ) : (
            <button
              className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!input.trim() || Boolean(blocked)}
              aria-label="Send message"
              onClick={() => send(input)}
            >
              ↑
            </button>
          )}
        </div>
        {messages.length > 0 && (
          <button
            className="mt-1 text-[11px] text-slate-500 hover:text-slate-600"
            title="Clears the transcript and starts a fresh AI session for this tree"
            onClick={() => void store.getState().clearChat()}
          >
            Clear chat
          </button>
        )}
      </div>
    </div>
  );
}
