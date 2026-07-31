"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { MetricNode as MetricNodeData, Severity } from "@kti/schema";
import {
  DIRECTION_STYLE,
  SEVERITY_RING,
  TIMELINESS_STYLE,
} from "@/lib/colors";
import { NODE_HEIGHT, NODE_WIDTH, NS_HEIGHT, NS_WIDTH } from "./layout";

export type DiffState = "added" | "removed" | "modified";

const DIFF_OUTLINE: Record<DiffState, string> = {
  added: "#16a34a",
  removed: "#dc2626",
  modified: "#d97706",
};

export type MetricFlowNode = Node<
  { node: MetricNodeData; severity: Severity | null; diff?: DiffState },
  "metric"
>;

function MetricNodeComponent({ data, selected }: NodeProps<MetricFlowNode>) {
  const { node, severity, diff } = data;
  const isNorthStar = node.level === "north_star";
  const direction = DIRECTION_STYLE[node.direction];
  const size = isNorthStar
    ? { width: NS_WIDTH, height: NS_HEIGHT }
    : { width: NODE_WIDTH, height: NODE_HEIGHT };

  return (
    <div
      className={[
        "flex flex-col justify-center rounded-lg border px-3 py-2 shadow-sm transition-shadow",
        "border-l-4",
        direction.border,
        isNorthStar
          ? "border-indigo-700 bg-indigo-600 text-white shadow-md"
          : "border-slate-200 bg-white",
        selected ? "shadow-lg" : "",
      ].join(" ")}
      style={{
        width: size.width,
        height: size.height,
        outline: diff
          ? `2.5px solid ${DIFF_OUTLINE[diff]}`
          : severity
            ? `2.5px solid ${SEVERITY_RING[severity]}`
            : undefined,
        outlineOffset: diff || severity ? 2 : undefined,
        opacity: diff === "removed" ? 0.45 : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="flex items-start justify-between gap-1">
        <div
          dir="auto"
          className={[
            "bidi-plaintext truncate font-semibold",
            isNorthStar ? "text-[15px]" : "text-[13px]",
          ].join(" ")}
          title={node.title}
        >
          {isNorthStar ? "⭐ " : node.direction === "guard" ? "🛡 " : ""}
          {node.title}
        </div>
        {node.timeliness && (
          <span
            className={`shrink-0 rounded px-1 py-px text-[9px] font-bold tracking-wide ${TIMELINESS_STYLE[node.timeliness].chip}`}
          >
            {TIMELINESS_STYLE[node.timeliness].label}
          </span>
        )}
      </div>
      <div
        dir="auto"
        className={[
          "bidi-plaintext mt-1 truncate font-mono text-[11px]",
          isNorthStar ? "text-indigo-100" : "text-slate-500",
        ].join(" ")}
        title={node.formula}
      >
        {node.formula}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

export const MetricNode = memo(MetricNodeComponent);
