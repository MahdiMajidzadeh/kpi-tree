import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kti-chat-test-"));
process.env.KTI_DB_PATH = path.join(tmpDir, "test.db");

// Imports after env var so the DB lands in the temp dir.
const { createTree, deleteTree } = await import("@/db/repo/trees");
const { appendChatMessage, clearChatMessages, listChatMessages, recentExchanges } =
  await import("@/server/ai/chat");
const { toolLabel } = await import("@/lib/ai/chat-types");

let treeId: string;

beforeAll(() => {
  treeId = createTree({ name: "Chat tree", productDescription: "", intakeAnswers: {} }).id;
});

describe("chat persistence", () => {
  it("round-trips a turn in insertion order", () => {
    appendChatMessage(treeId, { role: "user", content: "What's missing?" });
    appendChatMessage(treeId, {
      role: "assistant",
      content: "A retention guard.",
      toolCalls: [{ id: "t1", name: "mcp__kti__run_linter", label: "Running the linter" }],
      suggestionIds: ["s1"],
    });

    const messages = listChatMessages(treeId);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1]!.toolCalls[0]!.label).toBe("Running the linter");
    expect(messages[1]!.suggestionIds).toEqual(["s1"]);
    expect(messages[1]!.status).toBe("complete");
    expect(messages[1]!.seq).toBeGreaterThan(messages[0]!.seq);
  });

  it("keeps transcripts scoped to their tree", () => {
    const other = createTree({ name: "Other", productDescription: "", intakeAnswers: {} });
    appendChatMessage(other.id, { role: "user", content: "different tree" });
    expect(listChatMessages(treeId)).toHaveLength(2);
    expect(listChatMessages(other.id)).toHaveLength(1);
    deleteTree(other.id);
  });

  it("renders recent exchanges as a replayable digest", () => {
    const digest = recentExchanges(treeId);
    expect(digest).toContain("PM: What's missing?");
    expect(digest).toContain("You: A retention guard.");
  });

  it("clears only the requested tree", () => {
    clearChatMessages(treeId);
    expect(listChatMessages(treeId)).toEqual([]);
    expect(recentExchanges(treeId)).toBe("");
  });

  it("cascades when the tree is deleted", () => {
    const doomed = createTree({ name: "Doomed", productDescription: "", intakeAnswers: {} });
    appendChatMessage(doomed.id, { role: "user", content: "hi" });
    deleteTree(doomed.id);
    expect(listChatMessages(doomed.id)).toEqual([]);
  });
});

describe("toolLabel", () => {
  it("humanizes kti tool names", () => {
    expect(toolLabel("mcp__kti__propose_suggestion")).toBe("Drafting a metric");
    expect(toolLabel("mcp__kti__read_tree")).toBe("Reading the tree");
  });

  it("falls back to the bare name for unknown tools", () => {
    expect(toolLabel("mcp__kti__some_new_tool")).toBe("some new tool");
  });
});
