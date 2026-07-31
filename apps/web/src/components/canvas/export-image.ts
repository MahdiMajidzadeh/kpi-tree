"use client";

import { toPng, toSvg } from "html-to-image";
import {
  getNodesBounds,
  getViewportForBounds,
  type ReactFlowInstance,
} from "@xyflow/react";

/** PNG/SVG export of the canvas (FR-5.4). Snapshots the live DOM, so RTL
 *  shaping and fonts come along; html-to-image inlines same-origin webfonts. */
export async function exportCanvasImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reactFlow: ReactFlowInstance<any, any>,
  format: "png" | "svg",
  fileName: string,
): Promise<void> {
  const nodes = reactFlow.getNodes();
  if (nodes.length === 0) return;
  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl) return;

  const bounds = getNodesBounds(nodes);
  const padding = 40;
  const width = Math.min(Math.max(bounds.width + padding * 2, 640), 4096);
  const height = Math.min(Math.max(bounds.height + padding * 2, 480), 4096);
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 0.06);

  const options = {
    backgroundColor: "#f8fafc",
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node: HTMLElement) =>
      !node.classList?.contains("react-flow__minimap") &&
      !node.classList?.contains("react-flow__controls"),
  };

  const dataUrl =
    format === "png"
      ? await toPng(viewportEl, { ...options, pixelRatio: 2 })
      : await toSvg(viewportEl, options);

  const link = document.createElement("a");
  link.download = `${fileName}.${format}`;
  link.href = dataUrl;
  link.click();
}
