"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessModel, LifecycleStage } from "@kti/schema";

const BUSINESS_MODELS: { value: BusinessModel; label: string }[] = [
  { value: "marketplace", label: "Marketplace" },
  { value: "saas", label: "SaaS" },
  { value: "subscription_commerce", label: "Subscription commerce" },
  { value: "media", label: "Media" },
  { value: "fintech", label: "Fintech" },
  { value: "d2c", label: "D2C" },
  { value: "other", label: "Other" },
];

const STAGES: { value: LifecycleStage; label: string }[] = [
  { value: "launch", label: "Launch" },
  { value: "growth", label: "Growth" },
  { value: "maturity", label: "Maturity" },
];

interface NorthStarCandidate {
  title: string;
  formula: string;
  tradeoffs: string;
}

type Phase =
  | { kind: "form" }
  | { kind: "choosing"; candidates: NorthStarCandidate[] }
  | { kind: "generating"; treeId: string; state: string; message?: string }
  | { kind: "failed"; message: string };

export function IntakeForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessModel, setBusinessModel] = useState<BusinessModel | "">("");
  const [northStar, setNorthStar] = useState("");
  const [helpMeChoose, setHelpMeChoose] = useState(false);
  const [stage, setStage] = useState<LifecycleStage | "">("");
  const [monetization, setMonetization] = useState("");

  const eventSource = useRef<EventSource | null>(null);
  useEffect(() => () => eventSource.current?.close(), []);

  const intakePayload = (chosenNorthStar?: string) => ({
    name: name.trim() || undefined,
    productDescription: description.trim(),
    intakeAnswers: {
      ...(businessModel ? { businessModel } : {}),
      ...(helpMeChoose
        ? { northStarIntent: "help_me_choose" }
        : northStar.trim()
          ? { northStarIntent: northStar.trim() }
          : {}),
      ...(stage ? { lifecycleStage: stage } : {}),
      ...(monetization.trim() ? { monetization: monetization.trim() } : {}),
    },
    ...(chosenNorthStar ? { chosenNorthStar } : {}),
  });

  const watchGeneration = (treeId: string) => {
    setPhase({ kind: "generating", treeId, state: "generating" });
    const source = new EventSource(`/api/trees/${treeId}/events`);
    eventSource.current = source;
    source.addEventListener("generation_progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        state: string;
        message?: string;
      };
      if (data.state === "failed") {
        source.close();
        setPhase({
          kind: "failed",
          message: data.message ?? "Generation failed.",
        });
        return;
      }
      if (data.state === "done") {
        source.close();
        router.push(`/trees/${treeId}`);
        return;
      }
      setPhase({
        kind: "generating",
        treeId,
        state: data.state,
        ...(data.message !== undefined ? { message: data.message } : {}),
      });
    });
    source.onerror = () => {
      // EventSource retries automatically; nothing to do.
    };
  };

  const submit = async () => {
    if (description.trim().length < 50) return;
    setBusy(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intakePayload()),
      });
      const data = (await response.json()) as {
        treeId?: string;
        candidates?: NorthStarCandidate[];
        error?: string;
      };
      if (!response.ok) {
        setPhase({ kind: "failed", message: data.error ?? "Generation failed." });
        return;
      }
      if (data.candidates) {
        setPhase({ kind: "choosing", candidates: data.candidates });
        return;
      }
      if (data.treeId) watchGeneration(data.treeId);
    } catch {
      setPhase({ kind: "failed", message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const chooseNorthStar = async (candidate: NorthStarCandidate) => {
    setBusy(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intakePayload(candidate.title)),
      });
      const data = (await response.json()) as { treeId?: string; error?: string };
      if (!response.ok || !data.treeId) {
        setPhase({ kind: "failed", message: data.error ?? "Generation failed." });
        return;
      }
      watchGeneration(data.treeId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-6">
      <div className="max-h-full w-[560px] max-w-full overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        {phase.kind === "form" && (
          <>
            <h2 className="text-lg font-semibold text-slate-900">
              Generate a KPI tree
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Describe the product; optional context sharpens the draft.
            </p>

            <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-slate-600">
              Tree name (optional)
              <input
                dir="auto"
                className="bidi-plaintext rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Digikala Marketplace"
              />
            </label>

            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-600">
              Product description * (min 50 characters)
              <textarea
                dir="auto"
                rows={5}
                className="bidi-plaintext resize-none rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is the product, who uses it, how does it make money, what matters right now…"
              />
              <span
                className={
                  description.trim().length < 50 ? "text-amber-600" : "text-slate-400"
                }
              >
                {description.trim().length}/50
              </span>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Business model
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={businessModel}
                  onChange={(e) => setBusinessModel(e.target.value as BusinessModel | "")}
                >
                  <option value="">—</option>
                  {BUSINESS_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Lifecycle stage
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as LifecycleStage | "")}
                >
                  <option value="">—</option>
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-600">
              Intended North Star
              <input
                dir="auto"
                className="bidi-plaintext rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                value={northStar}
                disabled={helpMeChoose}
                onChange={(e) => setNorthStar(e.target.value)}
                placeholder="e.g., Weekly completed orders"
              />
              <label className="mt-1 flex items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={helpMeChoose}
                  onChange={(e) => setHelpMeChoose(e.target.checked)}
                />
                Help me choose (get 2–3 candidates with trade-offs)
              </label>
            </label>

            <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate-600">
              Monetization model
              <input
                dir="auto"
                className="bidi-plaintext rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={monetization}
                onChange={(e) => setMonetization(e.target.value)}
                placeholder="e.g., commission + ads"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={description.trim().length < 50 || busy}
                onClick={() => void submit()}
              >
                {busy ? "Starting…" : "Generate tree"}
              </button>
            </div>
          </>
        )}

        {phase.kind === "choosing" && (
          <>
            <h2 className="text-lg font-semibold text-slate-900">
              Pick a North Star
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The whole tree decomposes from this choice.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {phase.candidates.map((candidate) => (
                <button
                  key={candidate.title}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 p-3 text-start hover:border-indigo-400 hover:bg-indigo-50/50 disabled:opacity-50"
                  onClick={() => void chooseNorthStar(candidate)}
                >
                  <div dir="auto" className="bidi-plaintext text-sm font-semibold text-slate-800">
                    {candidate.title}
                  </div>
                  <div dir="auto" className="bidi-plaintext mt-0.5 font-mono text-xs text-slate-500">
                    {candidate.formula}
                  </div>
                  <div dir="auto" className="bidi-plaintext mt-1 text-xs text-slate-600">
                    {candidate.tradeoffs}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {phase.kind === "generating" && (
          <div className="py-6 text-center">
            <div className="text-3xl">🌳</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              {phase.state === "generating" && "Generating your KPI tree…"}
              {phase.state === "validating" && "Validating structure…"}
              {phase.state === "rendering" && "Rendering canvas…"}
            </h2>
            <p dir="auto" className="bidi-plaintext mt-1 text-sm text-slate-500">
              {phase.message ?? "This usually takes under 90 seconds."}
            </p>
            <div className="mx-auto mt-4 h-1.5 w-56 overflow-hidden rounded bg-slate-100">
              <div className="h-full w-1/3 animate-pulse rounded bg-indigo-600" />
            </div>
          </div>
        )}

        {phase.kind === "failed" && (
          <div className="py-4">
            <h2 className="text-lg font-semibold text-red-700">Generation failed</h2>
            <p dir="auto" className="bidi-plaintext mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {phase.message}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setPhase({ kind: "form" })}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
