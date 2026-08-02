/** Shared chat shapes — imported by both the route handler and the panel, so
 *  this module stays free of server-only imports. */

export type ChatRole = "user" | "assistant";
export type ChatStatus = "complete" | "error" | "interrupted";

export interface ChatToolCall {
  /** Tool-use id, used to de-duplicate partial vs. final message reporting. */
  id: string;
  name: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  seq: number;
  treeId: string;
  role: ChatRole;
  content: string;
  toolCalls: ChatToolCall[];
  /** Suggestions the agent proposed during this turn (rendered inline). */
  suggestionIds: string[];
  status: ChatStatus;
  createdAt: number;
}

const TOOL_LABELS: Record<string, string> = {
  read_tree: "Reading the tree",
  read_mutations: "Reading recent edits",
  run_linter: "Running the linter",
  read_pattern: "Consulting the pattern library",
  propose_suggestion: "Drafting a metric",
};

/** "mcp__kti__run_linter" → "Running the linter". */
export function toolLabel(name: string): string {
  const bare = name.replace(/^mcp__kti__/, "");
  return TOOL_LABELS[bare] ?? bare.replace(/_/g, " ");
}

/** Live server→client stream frames (SSE event names). */
export type ChatStreamEvent =
  | { type: "user_message"; message: ChatMessage }
  | { type: "status"; state: "queued" | "thinking" }
  | { type: "delta"; text: string }
  | { type: "tool"; call: ChatToolCall }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; error: string; message: ChatMessage };
