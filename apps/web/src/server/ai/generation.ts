import { nanoid } from "nanoid";
import { z } from "zod";
import {
  validateTreeStructure,
  type Edge,
  type IntakeAnswers,
  type MetricNode,
  type MutationEvent,
} from "@kti/schema";
import { getDb } from "@/db/client";
import { generationFailures } from "@/db/schema";
import { renameTree } from "@/db/repo/trees";
import { applyMutations } from "@/server/apply-mutations";
import { publish } from "@/server/events";
import { getSettings } from "@/server/settings";
import { runAgentQuery } from "./client";
import {
  GeneratedTreeSchema,
  NorthStarCandidatesSchema,
  toDraft7,
  type GeneratedTree,
  type NorthStarCandidates,
} from "./schemas";
import { BASE_SYSTEM } from "./prompts/base";
import {
  GENERATE_APPENDIX,
  buildGeneratePrompt,
  buildRetryPrompt,
} from "./prompts/generate";
import { NORTH_STAR_APPENDIX, buildNorthStarPrompt } from "./prompts/northstar";
import { loadPattern } from "./patterns";

/** Semantic checks beyond what JSON schema can express (FR-1.2). */
export function validateGenerated(tree: GeneratedTree): string[] {
  const errors = validateTreeStructure(
    tree.nodes.map((n) => ({ id: n.id, level: n.level, title: n.title })),
    tree.edges.map((e, i) => ({ id: `e${i}`, source: e.source, target: e.target })),
  );

  if (!tree.nodes.some((n) => n.direction === "guard")) {
    errors.push("The tree has no guard (counter-metric) node; at least one is required.");
  }

  // Depth from the North Star must be 2–5 levels (2–4 driver levels).
  const northStar = tree.nodes.find((n) => n.level === "north_star");
  if (northStar) {
    const children = new Map<string, string[]>();
    for (const e of tree.edges) {
      children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
    }
    let maxDepth = 0;
    const queue: [string, number][] = [[northStar.id, 0]];
    const seen = new Set([northStar.id]);
    while (queue.length > 0) {
      const [id, d] = queue.shift()!;
      maxDepth = Math.max(maxDepth, d);
      for (const child of children.get(id) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        queue.push([child, d + 1]);
      }
    }
    if (maxDepth < 2) {
      errors.push(
        `The tree is only ${maxDepth} level(s) deep below the North Star; decompose drivers further (2–4 driver levels required).`,
      );
    }
    if (maxDepth > 5) {
      errors.push(`The tree is ${maxDepth} levels deep; keep it within 5 levels.`);
    }
    const unreachable = tree.nodes.filter((n) => !seen.has(n.id));
    for (const n of unreachable) {
      errors.push(`Node "${n.title}" (${n.id}) is not reachable from the North Star.`);
    }
  }
  return errors;
}

export async function runNorthStarCandidates(args: {
  productDescription: string;
  intakeAnswers: IntakeAnswers;
}): Promise<
  | { ok: true; candidates: NorthStarCandidates["candidates"] }
  | { ok: false; error: string }
> {
  const settings = getSettings();
  const result = await runAgentQuery({
    treeId: "__northstar__", // no tree yet; stateless task
    useSession: false,
    prompt: buildNorthStarPrompt(args),
    systemPrompt: BASE_SYSTEM + NORTH_STAR_APPENDIX,
    model: settings.models.suggestions,
    maxTurns: 2,
    outputSchema: toDraft7(NorthStarCandidatesSchema),
  });
  if (!result.ok) return { ok: false, error: result.error };
  const parsed = NorthStarCandidatesSchema.safeParse(result.structured);
  if (!parsed.success) {
    return { ok: false, error: "The model returned malformed candidates. Try again." };
  }
  return { ok: true, candidates: parsed.data.candidates };
}

function persistGenerated(treeId: string, generated: GeneratedTree): void {
  // Remap model-local ids to nanoids.
  const idMap = new Map<string, string>();
  const nodes: MetricNode[] = generated.nodes.map((n) => {
    const id = nanoid();
    idMap.set(n.id, id);
    return {
      id,
      title: n.title,
      formula: n.formula,
      reason: n.reason,
      level: n.level,
      direction: n.direction,
      ...(n.timeliness ? { timeliness: n.timeliness } : {}),
      tags: n.tags ?? [],
      origin: "generated" as const,
    };
  });
  const edges: Edge[] = generated.edges.map((e) => ({
    id: nanoid(),
    source: idMap.get(e.source)!,
    target: idMap.get(e.target)!,
    type: e.type,
    ...(e.note ? { note: e.note } : {}),
  }));

  const now = Date.now();
  const events: MutationEvent[] = [
    ...nodes.map(
      (node): MutationEvent => ({
        id: nanoid(),
        timestamp: now,
        type: "node_added",
        node,
      }),
    ),
    ...edges.map(
      (edge): MutationEvent => ({
        id: nanoid(),
        timestamp: now,
        type: "edge_added",
        edge,
      }),
    ),
  ];
  applyMutations(treeId, events);
}

function recordFailure(treeId: string, rawOutput: unknown, errors: string[]): void {
  getDb()
    .insert(generationFailures)
    .values({
      id: nanoid(),
      treeId,
      rawOutput: JSON.stringify(rawOutput ?? null),
      errors: JSON.stringify(errors),
      createdAt: Date.now(),
    })
    .run();
}

/** Full generation pipeline (FR-1.2/1.3/1.4), run detached from the request.
 *  Progress is streamed over the tree's SSE channel. */
export async function runGeneration(args: {
  treeId: string;
  productDescription: string;
  intakeAnswers: IntakeAnswers;
  chosenNorthStar?: string;
  nameWasProvided: boolean;
}): Promise<void> {
  const { treeId } = args;
  const settings = getSettings();
  const pattern = loadPattern(args.intakeAnswers.businessModel);

  publish(treeId, { type: "generation_progress", state: "generating" });

  const runOnce = (prompt: string) =>
    runAgentQuery({
      treeId,
      prompt,
      systemPrompt: BASE_SYSTEM + GENERATE_APPENDIX,
      model: settings.models.generation,
      maxTurns: 8,
      outputSchema: toDraft7(GeneratedTreeSchema),
      includePartialMessages: false,
    });

  const validate = (
    structured: unknown,
  ): { ok: true; tree: GeneratedTree } | { ok: false; errors: string[] } => {
    const parsed = GeneratedTreeSchema.safeParse(structured);
    if (!parsed.success) {
      return { ok: false, errors: z.prettifyError(parsed.error).split("\n") };
    }
    const semanticErrors = validateGenerated(parsed.data);
    if (semanticErrors.length > 0) return { ok: false, errors: semanticErrors };
    return { ok: true, tree: parsed.data };
  };

  try {
    const first = await runOnce(
      buildGeneratePrompt({
        productDescription: args.productDescription,
        intakeAnswers: args.intakeAnswers,
        patternMarkdown: pattern,
        ...(args.chosenNorthStar !== undefined
          ? { chosenNorthStar: args.chosenNorthStar }
          : {}),
      }),
    );
    if (!first.ok) {
      publish(treeId, {
        type: "generation_progress",
        state: "failed",
        message: first.error,
      });
      return;
    }

    publish(treeId, { type: "generation_progress", state: "validating" });
    let verdict = validate(first.structured);

    if (!verdict.ok) {
      // FR-1.3: one retry with the validation errors appended.
      publish(treeId, { type: "generation_progress", state: "generating", message: "Refining structure…" });
      const retry = await runOnce(buildRetryPrompt(verdict.errors));
      if (!retry.ok) {
        recordFailure(treeId, first.structured, verdict.errors);
        publish(treeId, {
          type: "generation_progress",
          state: "failed",
          message: retry.error,
        });
        return;
      }
      publish(treeId, { type: "generation_progress", state: "validating" });
      verdict = validate(retry.structured);
      if (!verdict.ok) {
        recordFailure(treeId, retry.structured, verdict.errors);
        publish(treeId, {
          type: "generation_progress",
          state: "failed",
          message:
            "The model couldn't produce a valid tree after a retry:\n" +
            verdict.errors.slice(0, 6).join("\n"),
        });
        return;
      }
    }

    publish(treeId, { type: "generation_progress", state: "rendering" });
    persistGenerated(treeId, verdict.tree);
    if (!args.nameWasProvided && verdict.tree.treeName) {
      renameTree(treeId, verdict.tree.treeName);
    }
    publish(treeId, { type: "generation_progress", state: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordFailure(treeId, null, [message]);
    publish(treeId, { type: "generation_progress", state: "failed", message });
  }
}
