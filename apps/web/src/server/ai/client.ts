import {
  query,
  type McpSdkServerConfigWithInstance,
  type Query,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { aiStatus, markOffline, markReady } from "./status";
import {
  budgetExhausted,
  recordUsage,
  resumeIdFor,
  storeSessionId,
  clearSessionId,
} from "./sessions";

export interface AgentTaskOptions {
  treeId: string;
  prompt: string;
  systemPrompt: string;
  model: string;
  maxTurns: number;
  /** JSON schema (draft-7) for structured output tasks. */
  outputSchema?: Record<string, unknown>;
  /** In-process kti tool server; when present, only its tools are allowed. */
  mcpServer?: McpSdkServerConfigWithInstance;
  /** Resume the tree's stored session (default true). */
  useSession?: boolean;
  includePartialMessages?: boolean;
  onMessage?: (message: SDKMessage) => void;
  /** Receives the live Query handle so callers can .interrupt(). */
  onStarted?: (q: Query) => void;
}

export type AgentTaskResult =
  | {
      ok: true;
      resultText: string;
      structured?: unknown;
      sessionId?: string;
      numTurns: number;
    }
  | { ok: false; kind: "offline" | "budget" | "error" | "interrupted"; error: string };

/** The single locked-down entry point to the Agent SDK (§7.2): no file
 *  system, no bash — only our in-process kti tools. */
export async function runAgentQuery(opts: AgentTaskOptions): Promise<AgentTaskResult> {
  const status = aiStatus();
  if (status.status === "offline") {
    return { ok: false, kind: "offline", error: status.reason ?? "AI offline" };
  }
  if (budgetExhausted(opts.treeId)) {
    return {
      ok: false,
      kind: "budget",
      error: "Session token budget exhausted for this tree. Raise it in Settings.",
    };
  }

  const useSession = opts.useSession ?? true;
  const resume = useSession ? resumeIdFor(opts.treeId) : undefined;

  const attempt = async (resumeId: string | undefined): Promise<AgentTaskResult> => {
    const q = query({
      prompt: opts.prompt,
      options: {
        systemPrompt: opts.systemPrompt,
        model: opts.model,
        maxTurns: opts.maxTurns,
        // Lock-down: remove every built-in tool; allow only our MCP tools.
        tools: [],
        ...(opts.mcpServer
          ? {
              mcpServers: { kti: opts.mcpServer },
              allowedTools: ["mcp__kti__*"],
            }
          : { allowedTools: [] }),
        permissionMode: "dontAsk" as const,
        ...(resumeId ? { resume: resumeId } : {}),
        ...(opts.outputSchema
          ? { outputFormat: { type: "json_schema" as const, schema: opts.outputSchema } }
          : {}),
        ...(opts.includePartialMessages ? { includePartialMessages: true } : {}),
      },
    });
    opts.onStarted?.(q);

    let resultText = "";
    let structured: unknown;
    let sessionId: string | undefined;
    let numTurns = 0;
    let errored: string | null = null;
    let interrupted = false;

    for await (const message of q) {
      opts.onMessage?.(message);
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      } else if (message.type === "result") {
        sessionId = message.session_id ?? sessionId;
        numTurns = message.num_turns ?? 0;
        const usage = message.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined;
        recordUsage(opts.treeId, {
          turns: numTurns,
          tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
          costUsd: message.total_cost_usd ?? 0,
        });
        if (message.subtype === "success") {
          resultText = message.result ?? "";
          structured = (message as { structured_output?: unknown }).structured_output;
        } else if (message.subtype === "error_during_execution") {
          const reason = (message as { error?: { message?: string } }).error?.message;
          if ((reason ?? "").toLowerCase().includes("interrupt")) interrupted = true;
          else errored = reason ?? "Agent task failed during execution.";
        } else {
          errored = `Agent task ended: ${message.subtype}`;
        }
      }
    }

    if (interrupted) {
      return { ok: false, kind: "interrupted", error: "Interrupted by newer edit." };
    }
    if (errored) {
      return { ok: false, kind: "error", error: errored };
    }
    if (useSession && sessionId) storeSessionId(opts.treeId, sessionId);
    markReady();
    return {
      ok: true,
      resultText,
      structured,
      ...(sessionId !== undefined ? { sessionId } : {}),
      numTurns,
    };
  };

  try {
    return await attempt(resume);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A GC'd/corrupt session file: retry once without resuming.
    if (resume && /session|resume/i.test(message)) {
      clearSessionId(opts.treeId);
      try {
        return await attempt(undefined);
      } catch (retryError) {
        const retryMessage =
          retryError instanceof Error ? retryError.message : String(retryError);
        markOffline(retryMessage);
        return { ok: false, kind: "error", error: retryMessage };
      }
    }
    if (/ENOENT|ECONN|fetch|network|api key|401|403|overloaded/i.test(message)) {
      markOffline(message);
      return { ok: false, kind: "offline", error: message };
    }
    return { ok: false, kind: "error", error: message };
  }
}
