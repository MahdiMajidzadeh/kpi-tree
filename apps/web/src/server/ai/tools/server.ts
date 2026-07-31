import { z } from "zod";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { lintTree } from "@kti/linter";
import { SuggestedFixSchema, type BusinessModel } from "@kti/schema";
import { getTree } from "@/db/repo/trees";
import { mutationsSince } from "@/db/repo/mutations";
import { loadPattern } from "../patterns";
import { AGENT_CATEGORIES, recordAgentInsight } from "../insights";
import { recordSuggestion } from "../suggestions";

export interface ToolCtx {
  treeId: string;
  /** Late propose_* calls after an interrupt are dropped (stale). */
  cancelled: () => boolean;
}

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value),
      },
    ],
  };
}

/**
 * Per-query, tree-scoped tool server (§7.2). Tools take no treeId — the
 * handlers close over it, so the agent can't wander to other trees.
 */
export function createKtiToolServer(
  ctx: ToolCtx,
  opts: { proposeInsight?: boolean; proposeSuggestion?: boolean } = {},
): McpSdkServerConfigWithInstance {
  const tools: NonNullable<Parameters<typeof createSdkMcpServer>[0]["tools"]> = [
    tool(
      "read_tree",
      "Current canonical KPI tree as JSON (nodes with id/title/formula/reason/level/direction/timeliness/tags, and typed edges).",
      {},
      async () => {
        const tree = getTree(ctx.treeId);
        if (!tree) return text("Tree not found.");
        return text({
          name: tree.name,
          productDescription: tree.productDescription,
          intakeAnswers: tree.intakeAnswers,
          nodes: tree.nodes.map(({ position: _p, ...rest }) => rest),
          edges: tree.edges,
        });
      },
    ),
    tool(
      "read_mutations",
      "Mutation events on this tree since a sequence number (0 = from the beginning). Returns [{seq, event}].",
      { since: z.number().int().min(0) },
      async (args) => text(mutationsSince(ctx.treeId, args.since).slice(-100)),
    ),
    tool(
      "run_linter",
      "Run the deterministic Tier-1 linter on the current tree. NEVER restate these findings as your own insights — the user already sees them.",
      {},
      async () => {
        const tree = getTree(ctx.treeId);
        if (!tree) return text("Tree not found.");
        return text(
          lintTree({ nodes: tree.nodes, edges: tree.edges }).map((v) => ({
            ruleId: v.ruleId,
            severity: v.severity,
            message: v.message,
            nodeIds: v.nodeIds,
          })),
        );
      },
    ),
    tool(
      "read_pattern",
      "Reference KPI-tree pattern for a business-model archetype (canonical decompositions, standard guards, common mistakes).",
      {
        archetype: z.enum([
          "marketplace",
          "saas",
          "subscription_commerce",
          "media",
          "fintech",
          "d2c",
        ]),
      },
      async (args) => {
        const body = loadPattern(args.archetype as BusinessModel);
        return text(body ?? "No pattern available for this archetype.");
      },
    ),
  ];

  if (opts.proposeInsight) {
    tools.push(
      tool(
        "propose_insight",
        "Emit ONE structured insight about the tree. Call once per insight. Severity 'error' is reserved for the deterministic linter — never use it.",
        {
          severity: z.enum(["warning", "info", "praise"]),
          category: z.enum(AGENT_CATEGORIES),
          title: z.string().max(80),
          body: z.string().max(400).describe("At most 3 sentences."),
          nodeIds: z.array(z.string()).max(6).describe("Existing node ids this concerns."),
          edgeIds: z.array(z.string()).max(6).optional(),
          suggestedFix: SuggestedFixSchema.optional(),
        },
        async (args) => {
          const tree = getTree(ctx.treeId);
          if (!tree) return text("Tree not found.");
          const nodeIds = new Set(tree.nodes.map((n) => n.id));
          const edgeIds = new Set(tree.edges.map((e) => e.id));
          const badNodes = args.nodeIds.filter((id) => !nodeIds.has(id));
          const badEdges = (args.edgeIds ?? []).filter((id) => !edgeIds.has(id));
          if (badNodes.length > 0 || badEdges.length > 0) {
            return {
              ...text(
                `Unknown ids: ${[...badNodes, ...badEdges].join(", ")}. Use ids from read_tree.`,
              ),
              isError: true,
            };
          }
          const outcome = recordAgentInsight(
            ctx.treeId,
            {
              severity: args.severity,
              category: args.category,
              title: args.title,
              body: args.body,
              nodeIds: args.nodeIds,
              ...(args.edgeIds ? { edgeIds: args.edgeIds } : {}),
              ...(args.suggestedFix ? { suggestedFix: args.suggestedFix } : {}),
            },
            ctx.cancelled,
          );
          if (outcome.outcome === "duplicate") return text(outcome.message);
          if (outcome.outcome === "stale") {
            return text("Discarded: the tree changed while you were analyzing.");
          }
          return text("Insight recorded.");
        },
      ),
    );
  }

  if (opts.proposeSuggestion) {
    tools.push(
      tool(
        "propose_suggestion",
        "Propose ONE complete missing-metric candidate, fully wired (parent + edge type). The tool simulates the insertion and runs the linter — if it returns an error, revise the candidate and try again.",
        {
          title: z.string().min(1).max(120),
          formula: z.string().min(1),
          reason: z.string().min(1).max(400),
          level: z.enum(["driver", "input"]),
          direction: z.enum(["increase", "decrease", "guard"]),
          timeliness: z.enum(["leading", "lagging"]).optional(),
          parentNodeId: z.string().describe("Existing node id from read_tree."),
          edgeType: z.enum(["multiplicative", "additive", "influence", "guard"]),
        },
        async (args) => {
          const outcome = recordSuggestion(ctx.treeId, args, ctx.cancelled);
          if (outcome.ok) return text("Suggestion accepted for user review.");
          return { ...text(outcome.error), isError: true };
        },
      ),
    );
  }

  return createSdkMcpServer({ name: "kti", version: "1.0.0", tools });
}
