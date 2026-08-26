"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";

// Intake for the appeal-assistance service. Collects what we genuinely need
// in order to prepare and file the appeal on the customer's behalf.
export function AppealForm({
  gameId,
  fee,
  onClose,
}: {
  gameId: string;
  fee: number | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appeal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          contactEmail: email,
          contactPhone: phone,
          details,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setError(body.error || "Could not continue. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <form onSubmit={submit} className="card relative z-10 my-8 w-full max-w-md p-6">
        <h2 className="font-display text-xl font-bold">Appeal assistance</h2>
        <p className="mt-1 text-sm text-muted">
          We prepare your appeal and file it with Garena support for you, then
          follow up on the case. For ID <span className="font-semibold text-ink">{gameId}</span>.
        </p>

        {/* Honest scope — stated before any payment. */}
        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
          <p className="font-semibold text-ink">What you&apos;re paying for</p>
          <p className="mt-1">
            Our time preparing, submitting and following up on your appeal. Garena
            alone decides the outcome — we cannot unban accounts and cannot
            guarantee one. You can also appeal yourself for free at Garena support.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="a-email">Email (for case updates)</label>
            <input
              id="a-email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="a-phone">Phone / WhatsApp (optional)</label>
            <input
              id="a-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="a-details">
              Anything that helps your case (optional)
            </label>
            <textarea
              id="a-details"
              rows={3}
              className="input"
              placeholder="When did the ban happen? Any purchase receipts, linked accounts…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 text-xs text-slate-600">
          <input
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          I understand this pays for appeal assistance, not a guaranteed unban.
        </label>

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={busy || !agreed} className="btn-primary flex-1">
            {busy ? (
              <Spinner className="h-5 w-5" />
            ) : fee == null ? (
              "Start free appeal"
            ) : (
              `Pay ₹${fee} & continue`
            )}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
