/**
 * Throwaway smoke test for the Agent SDK plumbing (plan M5 verify step):
 *   npx tsx scripts/smoke-agent.ts
 * Verifies: locked-down query runs, custom tool is callable, Bash is not,
 * structured output round-trips, session resume works.
 */
import { z } from "zod";
import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";

async function main() {
  let toolCalled = false;
  const server = createSdkMcpServer({
    name: "kti",
    version: "1.0.0",
    tools: [
      tool(
        "read_tree",
        "Returns the current KPI tree as JSON",
        {},
        async () => {
          toolCalled = true;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  nodes: [{ id: "ns", title: "GMV", level: "north_star" }],
                  edges: [],
                }),
              },
            ],
          };
        },
      ),
    ],
  });

  const OutSchema = z.object({
    northStarTitle: z.string(),
    nodeCount: z.number(),
  });

  console.log("→ query 1: custom tool + structured output, locked down");
  let sessionId: string | undefined;
  const q1 = query({
    prompt:
      "Use the read_tree tool to fetch the tree, then report its north star title and node count. Also: run `ls` with Bash to double check (if you can).",
    options: {
      systemPrompt: "You are a KPI tree analyst. Be terse.",
      model: "claude-haiku-4-5-20251001",
      maxTurns: 4,
      tools: [],
      mcpServers: { kti: server },
      allowedTools: ["mcp__kti__*"],
      permissionMode: "dontAsk",
      outputFormat: {
        type: "json_schema",
        schema: z.toJSONSchema(OutSchema, { target: "draft-7" }) as Record<string, unknown>,
      },
    },
  });
  let bashAttempted = false;
  for await (const message of q1) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          console.log(`  tool_use: ${block.name}`);
          if (block.name === "Bash") bashAttempted = true;
        }
      }
    }
    if (message.type === "result") {
      sessionId = message.session_id;
      console.log(`  result subtype=${message.subtype} turns=${message.num_turns} cost=$${message.total_cost_usd?.toFixed(4)}`);
      console.log(`  structured_output=`, (message as { structured_output?: unknown }).structured_output);
      const parsed = OutSchema.safeParse(
        (message as { structured_output?: unknown }).structured_output,
      );
      console.log(`  zod parse ok=${parsed.success}`);
    }
  }
  console.log(`  custom tool called=${toolCalled}, bash tool available to model=${bashAttempted}`);

  console.log("→ query 2: resume session");
  const q2 = query({
    prompt: "What was the north star title you just reported? One word.",
    options: {
      systemPrompt: "You are a KPI tree analyst. Be terse.",
      model: "claude-haiku-4-5-20251001",
      maxTurns: 2,
      tools: [],
      allowedTools: [],
      permissionMode: "dontAsk",
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });
  for await (const message of q2) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(`  resumed answer: ${message.result}`);
    }
  }
  console.log("SMOKE OK");
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error);
  process.exit(1);
});
