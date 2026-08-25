"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { StatusBadge } from "./StatusBadge";
import { CheckingSteps, STEPS } from "./CheckingSteps";
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
  const [paying, setPaying] = useState(false);

  // OTP modal (free unban flow)
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

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
    setStep(STEPS.length); // all steps ticked

    const { ok, b } = await lookup;
    if (!ok) setState({ phase: "error", message: b.error || "Something went wrong." });
    else setState({ phase: "result", data: b as PublicIdResult });
  }

  async function startGateway(id: string) {
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

  function onUnban(data: PublicIdResult) {
    if (data.free) {
      setOtp("");
      setOtpError(null);
      setOtpOpen(true);
    } else {
      startGateway(data.gameId);
    }
  }

  async function submitOtp(id: string) {
    if (!otp.trim()) {
      setOtpError("Please enter the OTP.");
      return;
    }
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: id, otp: otp.trim() }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setOtpError(body.error || "Could not verify OTP.");
        setOtpBusy(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setOtpError("Network error. Please try again.");
      setOtpBusy(false);
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
          <ResultCard data={state.data} paying={paying} onUnban={() => onUnban(state.data)} />
        )}
      </div>

      {otpOpen && state.phase === "result" && (
        <OtpModal
          gameId={state.data.gameId}
          otp={otp}
          setOtp={setOtp}
          error={otpError}
          busy={otpBusy}
          onClose={() => setOtpOpen(false)}
          onSubmit={() => submitOtp(state.data.gameId)}
        />
      )}
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
  const assistance = data.unbanEnabled ? "Available" : "Not available";
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
          <Row label={data.known ? "Reason" : "Assistance Category"} value={data.banReason} />
        )}
        {data.banDuration && (
          <Row label={data.known ? "Ban Duration" : "Review Period"} value={data.banDuration} />
        )}
        {data.unbanLeft != null && <Row label="Unban Left" value={`${data.unbanLeft} times`} />}
        {data.unbanEnabled && <Row label="Assistance Status" value={assistance} />}
        {data.unbanEnabled && (
          <Row label="Request Price" value={`$${data.priceUsd} · ₹${data.price} INR`} />
        )}

        {data.status === "UNBANNED" && (
          <p className="rounded-xl bg-emerald-500/10 p-4 text-emerald-700">
            This account is active and not banned. No action needed.
          </p>
        )}
        {data.status === "PENDING" && (
          <p className="rounded-xl bg-amber-500/10 p-4 text-amber-700">
            A request for this account is currently being processed.
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-xs text-white">
            ✓
          </span>
          <span className="text-sm font-semibold text-emerald-700">Status Verified</span>
        </div>

        {/* Admin-editable note (Settings → Result note). Empty = hidden. */}
        {data.note && (
          <p className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600">{data.note}</p>
        )}
      </div>

      {data.unbanEnabled ? (
        <button onClick={onUnban} disabled={paying} className="btn-primary mt-6 w-full sm:w-auto">
          {paying ? <Spinner className="h-5 w-5" /> : "Unban ID"}
        </button>
      ) : (
        data.status === "BANNED" && (
          <p className="mt-6 rounded-xl bg-slate-100 p-4 text-slate-600">
            This ID is not currently eligible for a self-service request.
          </p>
        )
      )}
    </div>
  );
}

function OtpModal({
  gameId,
  otp,
  setOtp,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  gameId: string;
  otp: string;
  setOtp: (v: string) => void;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="card relative z-10 w-full max-w-sm p-6">
        <h2 className="font-display text-xl font-bold">Enter OTP</h2>
        <p className="mt-1 text-sm text-muted">
          Enter the verification OTP to unban ID <span className="font-semibold text-ink">{gameId}</span>.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            className="input mt-4 text-center text-lg tracking-[0.4em]"
            placeholder="• • • •"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? <Spinner className="h-5 w-5" /> : "Verify & Unban"}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
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
