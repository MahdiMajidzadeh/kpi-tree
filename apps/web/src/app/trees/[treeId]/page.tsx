import { TreeEditor } from "@/components/editor/TreeEditor";

export default async function TreePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  return <TreeEditor treeId={treeId} />;
}
