/** Stable identity for a violation's underlying condition. */
export function fingerprint(
  ruleId: string,
  nodeIds: string[],
  edgeIds: string[],
): string {
  return `${ruleId}|${[...nodeIds].sort().join(",")}|${[...edgeIds].sort().join(",")}`;
}
