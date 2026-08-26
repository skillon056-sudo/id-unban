"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { StatusBadge } from "./StatusBadge";
import { CheckingSteps, STEPS } from "./CheckingSteps";
import { GARENA_APPEAL_URL } from "@/lib/links";
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
  const [busy, setBusy] = useState(false);

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

  // Records the request (free, no payment) and shows the confirmation page.
  async function saveRequest(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/request/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: id }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setState({ phase: "error", message: body.error || "Could not save the request." });
        setBusy(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setState({ phase: "error", message: "Network error. Please try again." });
      setBusy(false);
    }
  }

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
            busy={busy}
            onRequest={() => saveRequest(state.data.gameId)}
          />
        )}
      </div>
    </div>
  );
}

function ResultCard({
  data,
  busy,
  onRequest,
}: {
  data: PublicIdResult;
  busy: boolean;
  onRequest: () => void;
}) {
  return (
    <div className="card animate-fade-up p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Free Fire ID</p>
          <p className="font-display text-2xl font-bold tracking-wide">{data.gameId}</p>
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
        <Row label="Check Cost" value="Free" />

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

      {/* Official appeal — the real route to getting a ban lifted. */}
      <div className="mt-6 rounded-xl border border-accent/40 bg-accent/10 p-4">
        <p className="text-sm font-semibold text-ink">Appeal this ban (free)</p>
        <p className="mt-1 text-xs text-muted">
          Bans are reviewed and lifted only by Garena, through their official
          support channel. Submitting an appeal costs nothing.
        </p>
        <a
          href={GARENA_APPEAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-3 inline-flex w-full text-sm sm:w-auto"
        >
          Open Garena Support
        </a>
      </div>

      {data.requestEnabled && (
        <button onClick={onRequest} disabled={busy} className="btn-ghost mt-3 w-full sm:w-auto">
          {busy ? <Spinner className="h-5 w-5" /> : "Save this request"}
        </button>
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
