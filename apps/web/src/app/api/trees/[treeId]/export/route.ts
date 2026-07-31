import { NextResponse } from "next/server";
import { getTree } from "@/db/repo/trees";
import { exportMarkdown } from "@/server/export/markdown";
import { treeFileJson } from "@/server/export/tree-file";
import { exportMermaid } from "@/server/export/mermaid";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ treeId: string }> };

function filename(name: string, ext: string): string {
  const safe = name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "kpi-tree";
  return `${safe}.${ext}`;
}

export async function GET(request: Request, { params }: Params) {
  const { treeId } = await params;
  const tree = getTree(treeId);
  if (!tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";

  switch (format) {
    case "json":
      return new NextResponse(treeFileJson(tree), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename(tree.name, "json"))}`,
        },
      });
    case "markdown":
      return new NextResponse(exportMarkdown(tree), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename(tree.name, "md"))}`,
        },
      });
    case "mermaid":
      return new NextResponse(exportMermaid(tree), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename(tree.name, "mmd"))}`,
        },
      });
    default:
      return NextResponse.json(
        { error: `Unknown format "${format}" — use json, markdown, or mermaid.` },
        { status: 400 },
      );
  }
}
