import type { Direction, EdgeType, Severity } from "@kti/schema";

/** Visual encoding tokens (FR-2.4). One place, so canvas + exports agree. */

export const DIRECTION_STYLE: Record<
  Direction,
  { border: string; chip: string; label: string }
> = {
  increase: {
    border: "border-l-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    label: "↑ increase",
  },
  decrease: {
    border: "border-l-sky-500",
    chip: "bg-sky-100 text-sky-800",
    label: "↓ decrease",
  },
  guard: {
    border: "border-l-amber-500",
    chip: "bg-amber-100 text-amber-900",
    label: "🛡 guard",
  },
};

export const TIMELINESS_STYLE = {
  leading: { chip: "bg-violet-100 text-violet-700", label: "LEAD" },
  lagging: { chip: "bg-slate-200 text-slate-600", label: "LAG" },
} as const;

export const EDGE_STYLE: Record<
  EdgeType,
  { stroke: string; dash?: string; badge?: string }
> = {
  multiplicative: { stroke: "#64748b", badge: "×" },
  additive: { stroke: "#64748b", badge: "+" },
  influence: { stroke: "#94a3b8", dash: "6 4" },
  guard: { stroke: "#d97706", dash: "2 4", badge: "🛡" },
};

export const SEVERITY_RING: Record<Severity, string> = {
  error: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
  praise: "#16a34a",
};

export const SEVERITY_ORDER: Severity[] = ["error", "warning", "info", "praise"];

export function maxSeverity(severities: Severity[]): Severity | null {
  for (const s of SEVERITY_ORDER) {
    if (severities.includes(s)) return s;
  }
  return null;
}
