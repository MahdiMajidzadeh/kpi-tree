"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge as FlowEdge,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeType } from "@kti/schema";
import { DIFF_COLOR, EDGE_STYLE } from "@/lib/colors";

export type TypedFlowEdge = FlowEdge<
  { edgeType: EdgeType; diff?: "added" | "removed" | "modified" },
  "typed"
>;

const DIFF_STROKE = DIFF_COLOR;

function TypedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<TypedFlowEdge>) {
  const edgeType = data?.edgeType ?? "influence";
  const style = EDGE_STYLE[edgeType];
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: data?.diff ? DIFF_STROKE[data.diff] : style.stroke,
          strokeWidth: data?.diff ? 2.5 : selected ? 2.5 : 1.5,
          strokeDasharray: style.dash,
          opacity: data?.diff === "removed" ? 0.45 : undefined,
        }}
      />
      {style.badge && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-full border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-600 shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              ...(edgeType === "guard"
                ? { borderColor: "#d97706", color: "#92400e" }
                : {}),
            }}
          >
            {style.badge}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const TypedEdge = memo(TypedEdgeComponent);
