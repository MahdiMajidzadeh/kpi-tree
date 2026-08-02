import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db/client";
import { chatMessages } from "@/db/schema";
import type { ChatMessage, ChatRole, ChatStatus, ChatToolCall } from "@/lib/ai/chat-types";

/** Chat history is per-tree and unbounded on disk; only the tail is replayed
 *  into the UI (the agent's own memory lives in the resumed SDK session). */
const HISTORY_LIMIT = 200;

function rowToMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    seq: row.seq,
    treeId: row.treeId,
    role: row.role as ChatRole,
    content: row.content,
    toolCalls: JSON.parse(row.toolCalls) as ChatToolCall[],
    suggestionIds: JSON.parse(row.suggestionIds) as string[],
    status: row.status as ChatStatus,
    createdAt: row.createdAt,
  };
}

export function listChatMessages(treeId: string): ChatMessage[] {
  const rows = getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.treeId, treeId))
    .orderBy(asc(chatMessages.seq))
    .all();
  return rows.slice(-HISTORY_LIMIT).map(rowToMessage);
}

export function appendChatMessage(
  treeId: string,
  input: {
    role: ChatRole;
    content: string;
    toolCalls?: ChatToolCall[];
    suggestionIds?: string[];
    status?: ChatStatus;
  },
): ChatMessage {
  const id = nanoid();
  const createdAt = Date.now();
  const row = getDb()
    .insert(chatMessages)
    .values({
      id,
      treeId,
      role: input.role,
      content: input.content,
      toolCalls: JSON.stringify(input.toolCalls ?? []),
      suggestionIds: JSON.stringify(input.suggestionIds ?? []),
      status: input.status ?? "complete",
      createdAt,
    })
    .returning()
    .get();
  return rowToMessage(row);
}

export function clearChatMessages(treeId: string): void {
  getDb().delete(chatMessages).where(eq(chatMessages.treeId, treeId)).run();
}

/** The last few exchanges, for re-grounding the agent after a session reset. */
export function recentExchanges(treeId: string, turns = 4): string {
  const tail = listChatMessages(treeId)
    .filter((m) => m.content.trim().length > 0)
    .slice(-turns * 2);
  if (tail.length === 0) return "";
  return tail
    .map((m) => `${m.role === "user" ? "PM" : "You"}: ${m.content.slice(0, 600)}`)
    .join("\n");
}
