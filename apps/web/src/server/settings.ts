import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export const AppSettingsSchema = z.object({
  models: z
    .object({
      generation: z.string().min(1),
      deepAnalysis: z.string().min(1),
      realtime: z.string().min(1),
      suggestions: z.string().min(1),
      chat: z.string().min(1).default("claude-sonnet-5"),
    })
    .default({
      // Doc §FR-6: strongest model for generation + deep analysis,
      // fast model for the per-edit tier.
      generation: "claude-opus-5",
      deepAnalysis: "claude-opus-5",
      realtime: "claude-haiku-4-5-20251001",
      suggestions: "claude-sonnet-5",
      chat: "claude-sonnet-5",
    }),
  debounceMs: z.number().int().min(250).max(10_000).default(1500),
  realtimeEnabled: z.boolean().default(true),
  sessionTokenBudget: z.number().int().min(1_000).default(200_000),
  sessionTurnLimit: z.number().int().min(4).max(500).default(30),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

const KEY = "app";

export function getSettings(): AppSettings {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  if (!row) return AppSettingsSchema.parse({});
  try {
    return AppSettingsSchema.parse(JSON.parse(row.value));
  } catch {
    return AppSettingsSchema.parse({});
  }
}

export function updateSettings(patch: unknown): AppSettings {
  const current = getSettings();
  const merged = AppSettingsSchema.parse({
    ...current,
    ...(typeof patch === "object" && patch !== null ? patch : {}),
    models: {
      ...current.models,
      ...(typeof patch === "object" && patch !== null && "models" in patch
        ? (patch as { models: object }).models
        : {}),
    },
  });
  const db = getDb();
  db.insert(settings)
    .values({ key: KEY, value: JSON.stringify(merged) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(merged) } })
    .run();
  return merged;
}
