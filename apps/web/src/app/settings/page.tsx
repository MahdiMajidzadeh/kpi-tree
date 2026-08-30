"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppSettings } from "@/server/settings";

const MODEL_OPTIONS = [
  { value: "claude-opus-5", label: "Opus 5 (strongest)" },
  { value: "claude-sonnet-5", label: "Sonnet 5 (balanced)" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (fastest)" },
];

const TASKS: { key: keyof AppSettings["models"]; label: string; hint: string }[] = [
  { key: "generation", label: "Tree generation", hint: "Quality-critical, runs once per tree" },
  { key: "deepAnalysis", label: "Deep analysis", hint: "On-demand full-tree review" },
  { key: "realtime", label: "Real-time insight", hint: "Runs after every edit burst — keep it fast" },
  { key: "suggestions", label: "Metric suggestions", hint: "3–5 candidates per request" },
  { key: "chat", label: "Chat", hint: "Conversational Q&A in the editor sidebar" },
];

interface ClaudeCliInfo {
  found: boolean;
  path: string | null;
  version: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean | null>(null);
  const [claudeCli, setClaudeCli] = useState<ClaudeCliInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/settings");
      const data = (await response.json()) as {
        settings: AppSettings;
        apiKeyPresent: boolean;
        claudeCli: ClaudeCliInfo;
      };
      setSettings(data.settings);
      setApiKeyPresent(data.apiKeyPresent);
      setClaudeCli(data.claudeCli);
    })();
  }, []);

  const patch = async (partial: Record<string, unknown>) => {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const data = (await response.json()) as { settings: AppSettings };
    setSettings(data.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!settings) {
    return <main className="p-10 text-sm text-slate-500">Loading settings…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-8 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <div className="flex items-center gap-3">
          {saved && <span role="status" className="text-xs text-emerald-600">Saved ✓</span>}
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            ← Trees
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Claude connection</h2>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              claudeCli?.found || apiKeyPresent ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          {claudeCli?.found ? (
            <span className="text-slate-600">
              Claude Code CLI detected
              {claudeCli.version ? ` (${claudeCli.version})` : ""} at{" "}
              <code className="text-xs">{claudeCli.path}</code>
            </span>
          ) : apiKeyPresent ? (
            <span className="text-slate-600">
              API key detected (<code className="text-xs">ANTHROPIC_API_KEY</code>)
            </span>
          ) : (
            <span className="text-slate-600">
              No Claude credentials — set{" "}
              <code className="text-xs">ANTHROPIC_API_KEY</code> or log in with the
              Claude Code CLI. Everything except AI keeps working.
            </span>
          )}
        </div>
        {!claudeCli?.found && !apiKeyPresent && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Install Claude Code:</p>
            <pre className="mt-1.5 overflow-x-auto rounded bg-slate-900 p-2 text-slate-100">
              brew install --cask claude-code
            </pre>
            <p className="mt-1.5">
              or{" "}
              <code className="rounded bg-slate-200 px-1">
                curl -fsSL https://claude.ai/install.sh | bash
              </code>
            </p>
            <p className="mt-1.5">
              Then run <code className="rounded bg-slate-200 px-1">claude</code> in a
              terminal once to log in, and restart the server. Or set{" "}
              <code className="rounded bg-slate-200 px-1">ANTHROPIC_API_KEY</code> in{" "}
              <code className="rounded bg-slate-200 px-1">apps/web/.env.local</code>.
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Models per task</h2>
        <div className="mt-3 flex flex-col gap-3">
          {TASKS.map((task) => (
            <label
              key={task.key}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span>
                <span className="font-medium text-slate-700">{task.label}</span>
                <span className="block text-xs text-slate-500">{task.hint}</span>
              </span>
              <select
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={settings.models[task.key]}
                onChange={(e) =>
                  void patch({ models: { [task.key]: e.target.value } })
                }
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Real-time analysis</h2>
        <label className="mt-3 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            Analyze every edit burst
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={settings.realtimeEnabled}
            onChange={(e) => void patch({ realtimeEnabled: e.target.checked })}
          />
        </label>
        <label className="mt-3 flex items-center justify-between text-sm">
          <span>
            <span className="font-medium text-slate-700">Debounce (ms)</span>
            <span className="block text-xs text-slate-500">
              A burst of edits becomes one analysis
            </span>
          </span>
          <input
            type="number"
            min={250}
            max={10000}
            step={250}
            className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
            defaultValue={settings.debounceMs}
            onBlur={(e) => void patch({ debounceMs: Number(e.target.value) })}
          />
        </label>
        <label className="mt-3 flex items-center justify-between text-sm">
          <span>
            <span className="font-medium text-slate-700">Session token budget</span>
            <span className="block text-xs text-slate-500">
              AI stops when a tree&apos;s session spends this many tokens
            </span>
          </span>
          <input
            type="number"
            min={1000}
            step={10000}
            className="w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
            defaultValue={settings.sessionTokenBudget}
            onBlur={(e) => void patch({ sessionTokenBudget: Number(e.target.value) })}
          />
        </label>
      </section>
    </main>
  );
}
