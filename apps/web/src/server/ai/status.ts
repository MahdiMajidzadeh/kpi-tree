/** Global AI availability (§7.4). Offline on missing key or transport
 *  failure; any successful task flips back to ready. Budget exhaustion is
 *  per-tree and handled in budget.ts. */

type AiStatus = "ready" | "offline";

const store = globalThis as unknown as {
  __ktiAiStatus?: { status: AiStatus; reason?: string; since: number };
};

function state() {
  store.__ktiAiStatus ??= { status: "ready", since: Date.now() };
  return store.__ktiAiStatus;
}

export function apiKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** How long an offline verdict is trusted before the next call re-probes.
 *  Keeps the failure banner honest without ever getting stuck offline —
 *  e.g. after the user re-authenticates the Claude CLI, the next action
 *  (at most 30s later) attempts a real call and heals the state. */
const OFFLINE_TTL_MS = 30_000;

/** Optimistic: a missing ANTHROPIC_API_KEY is not proof of offline — the
 *  bundled CLI may hold Claude Code credentials (§7.4 allows that path).
 *  Real transport/auth failures flip us offline; success flips back. */
export function aiStatus(): { status: AiStatus; reason?: string } {
  const s = state();
  if (s.status === "offline" && Date.now() - s.since > OFFLINE_TTL_MS) {
    return { status: "ready" }; // stale verdict — let the next call re-probe
  }
  return { status: s.status, ...(s.reason !== undefined ? { reason: s.reason } : {}) };
}

export function markOffline(reason: string): void {
  store.__ktiAiStatus = { status: "offline", reason, since: Date.now() };
}

export function markReady(): void {
  store.__ktiAiStatus = { status: "ready", since: Date.now() };
}
