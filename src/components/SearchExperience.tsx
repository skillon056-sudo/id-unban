"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { StatusBadge } from "./StatusBadge";
import type { PublicIdResult } from "@/lib/types";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "result"; data: PublicIdResult };

export function SearchExperience() {
  const [gameId, setGameId] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [paying, setPaying] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = gameId.trim();
    if (!/^\d{6,15}$/.test(id)) {
      setState({ phase: "error", message: "Enter a valid numeric Free Fire ID (6–15 digits)." });
      return;
    }
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/id/${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: body.error || "Something went wrong." });
        return;
      }
      setState({ phase: "result", data: body });
    } catch {
      setState({ phase: "error", message: "Network error. Please try again." });
    }
  }

  async function onUnban(id: string) {
    setPaying(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: id }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setState({ phase: "error", message: body.error || "Could not start payment." });
        setPaying(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setState({ phase: "error", message: "Network error starting payment." });
      setPaying(false);
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
        <button type="submit" className="btn-primary" disabled={state.phase === "loading"}>
          {state.phase === "loading" ? <Spinner className="h-5 w-5" /> : "Check ID Status"}
        </button>
      </form>

      <div className="mt-5" aria-live="polite">
        {state.phase === "error" && (
          <div className="card border-red-500/30 p-5 text-red-600">{state.message}</div>
        )}

        {state.phase === "result" && (
          <ResultCard data={state.data} paying={paying} onUnban={() => onUnban(state.data.gameId)} />
        )}
      </div>
    </div>
  );
}

function ResultCard({
  data,
  paying,
  onUnban,
}: {
  data: PublicIdResult;
  paying: boolean;
  onUnban: () => void;
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
        {data.status === "BANNED" && (
          <Row label="Reason" value={data.banReason || "Not specified"} />
        )}
        {data.unbanLeft != null && (
          <Row label="Unban Left" value={`${data.unbanLeft} times`} />
        )}
        {data.status === "BANNED" && data.unbanEnabled && (
          <Row label="Unban fee" value={`₹${data.price}`} />
        )}
        {data.status === "UNBANNED" && (
          <p className="rounded-xl bg-emerald-500/10 p-4 text-emerald-700">
            This account is active and not banned. No action needed.
          </p>
        )}
        {data.status === "PENDING" && (
          <p className="rounded-xl bg-amber-500/10 p-4 text-amber-700">
            An unban request for this account is currently being processed.
          </p>
        )}
      </div>

      {data.status === "BANNED" && data.unbanEnabled && (
        <button onClick={onUnban} disabled={paying} className="btn-primary mt-6 w-full sm:w-auto">
          {paying ? <Spinner className="h-5 w-5" /> : `Unban ID · ₹${data.price}`}
        </button>
      )}
      {data.status === "BANNED" && !data.unbanEnabled && (
        <p className="mt-6 rounded-xl bg-slate-100 p-4 text-slate-600">
          This ID is not currently eligible for a self-service unban request.
        </p>
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
