"use client";

import { toPng, toSvg } from "html-to-image";
import {
  getNodesBounds,
  getViewportForBounds,
  type ReactFlowInstance,
} from "@xyflow/react";
import { CANVAS_BG } from "@/lib/colors";

/** Cuts of Dana the canvas can actually render (see components/canvas/*).
 *  Left to itself, html-to-image would inline every @font-face in the document
 *  — all 20 weights in both woff2 and woff — into each exported file, so we
 *  hand it a pre-built stylesheet covering just these. */
const EXPORT_FONT_WEIGHTS = [
  { file: "dana-regular", weight: 400 },
  { file: "dana-medium", weight: 500 },
  { file: "dana-demibold", weight: 600 },
  { file: "dana-bold", weight: 700 },
];

let fontEmbedCSSPromise: Promise<string> | undefined;

/** Base64-inlines the export fonts so the PNG/SVG renders correctly outside the
 *  app. Memoized: the bytes are identical for every export in a session. */
function getFontEmbedCSS(): Promise<string> {
  fontEmbedCSSPromise ??= Promise.all(
    EXPORT_FONT_WEIGHTS.map(async ({ file, weight }) => {
      const response = await fetch(`/fonts/${file}.woff2`);
      if (!response.ok) return "";
      const buffer = await response.arrayBuffer();
      let binary = "";
      for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCharCode(byte);
      }
      return `@font-face{font-family:"Dana";font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2");}`;
    }),
  )
    .then((rules) => rules.join(""))
    // A failed fetch shouldn't block the export — it just falls back to
    // whatever font the viewer has.
    .catch(() => "");

  return fontEmbedCSSPromise;
}

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
    backgroundColor: CANVAS_BG,
    fontEmbedCSS: await getFontEmbedCSS(),
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
