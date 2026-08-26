"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { StatusBadge } from "./StatusBadge";
import { CheckingSteps, STEPS } from "./CheckingSteps";
import { AppealForm } from "./AppealForm";
import type { PublicIdResult } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type State =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "error"; message: string }
  | { phase: "result"; data: PublicIdResult };

export function SearchExperience() {
  const [gameId, setGameId] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [step, setStep] = useState(0);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = gameId.trim();
    if (!/^\d{6,15}$/.test(id)) {
      setState({ phase: "error", message: "Please enter a valid Free Fire ID." });
      return;
    }

    setStep(0);
    setState({ phase: "checking" });

    // Kick off the real lookup while the animation plays.
    const lookup = fetch(`/api/id/${encodeURIComponent(id)}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .catch(() => ({ ok: false, b: { error: "Network error. Please try again." } }));

    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await sleep(STEPS[i].ms);
    }
    setStep(STEPS.length);

    const { ok, b } = await lookup;
    if (!ok) setState({ phase: "error", message: b.error || "Something went wrong." });
    else setState({ phase: "result", data: b as PublicIdResult });
  }

  const [formOpen, setFormOpen] = useState(false);

  return (
    <div id="check" className="scroll-mt-24">
      <form onSubmit={onSearch} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <label htmlFor="gameId" className="sr-only">Free Fire ID</label>
        <input
          id="gameId"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Enter your Free Fire ID (e.g. 100000001)"
          className="input flex-1"
          value={gameId}
          onChange={(e) => setGameId(e.target.value.replace(/\D/g, ""))}
        />
        <button type="submit" className="btn-primary" disabled={state.phase === "checking"}>
          {state.phase === "checking" ? <Spinner className="h-5 w-5" /> : "Check ID Status"}
        </button>
      </form>

      <div className="mt-5" aria-live="polite">
        {state.phase === "checking" && <CheckingSteps step={step} />}

        {state.phase === "error" && (
          <div className="card border-red-500/30 p-5 text-red-600">{state.message}</div>
        )}

        {state.phase === "result" && (
          <ResultCard
            data={state.data}
            formOpen={formOpen}
            onRequest={() => setFormOpen(true)}
            onCancel={() => setFormOpen(false)}
          />
        )}
      </div>

    </div>
  );
}

function ResultCard({
  data,
  formOpen,
  onRequest,
  onCancel,
}: {
  data: PublicIdResult;
  formOpen: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="card animate-fade-up p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Free Fire ID</p>
          <p className="font-display text-2xl font-bold tracking-wide">{data.gameId}</p>
          {data.username && (
            <p className="mt-1 text-sm font-medium text-accent2">{data.username}</p>
          )}
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm">
        {data.banReason && (
          <Row
            label={data.source === "admin" ? "Reason" : "Assistance Category"}
            value={data.banReason}
          />
        )}
        {data.banDuration && <Row label="Ban Duration" value={data.banDuration} />}
        {data.unbanLeft != null && <Row label="Unban Left" value={`${data.unbanLeft} times`} />}
        {data.requestEnabled && (
          <Row label="Service Fee" value={data.fee == null ? "Free" : `₹${data.fee}`} />
        )}

        {data.status === "UNBANNED" && (
          <p className="rounded-xl bg-emerald-500/10 p-4 text-emerald-700">
            This account is not showing as banned. No action needed.
          </p>
        )}
        {data.status === "INFORMATION UNAVAILABLE" && (
          <p className="rounded-xl bg-slate-100 p-4 text-slate-600">
            We couldn&apos;t retrieve information for this ID right now. You can still
            check it directly on Garena&apos;s official support page.
          </p>
        )}
        {data.note && (
          <p className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600">{data.note}</p>
        )}
      </div>

      {data.requestEnabled && (
        <div className="mt-6">
          {formOpen ? (
            <AppealForm gameId={data.gameId} fee={data.fee} onCancel={onCancel} />
          ) : (
            <button onClick={onRequest} className="btn-primary w-full sm:w-auto">
              {data.ctaLabel}
            </button>
          )}

          {/* Says what the money buys, before anyone pays. */}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {data.fee == null ? "This" : `₹${data.fee}`} covers preparing your appeal,
            submitting it to Garena support and following up. Garena decides the
            outcome — we can&apos;t unban accounts or guarantee a result, and you can
            appeal yourself for free at Garena support.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
