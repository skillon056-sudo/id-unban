"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { OpenInBrowser } from "./OpenInBrowser";
import { detectInApp } from "@/lib/in-app-browser";

// Same shape the server validates with — keep the two in step.
const UPI_RE = /^[a-z0-9._-]{2,64}@[a-z]{2,32}$/;

export function DepositForm({
  orderId,
  amount,
  termsPublished,
}: {
  orderId: string;
  amount: number;
  termsPublished: boolean;
}) {
  const [upi, setUpi] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);

  const upiValid = UPI_RE.test(upi.trim().toLowerCase());
  const canPay = upiValid && agreed && termsPublished && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPay) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, upiId: upi.trim().toLowerCase() }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setError(body.error || "Could not continue. Please try again.");
        setBusy(false);
        return;
      }
      // In-app browsers can't reach a UPI app — hand off instead of dead-ending.
      if (body.redirectUrl.startsWith("http") && detectInApp().isInApp) {
        setHandoffUrl(body.redirectUrl);
        setBusy(false);
        return;
      }
      window.location.href = body.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (handoffUrl) return <OpenInBrowser url={handoffUrl} />;

  return (
    <form onSubmit={submit} className="mt-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <label className="label" htmlFor="upi">
        Enter your UPI ID for the refund
      </label>
      <input
        id="upi"
        required
        autoComplete="off"
        inputMode="email"
        placeholder="example@upi"
        className="input"
        value={upi}
        onChange={(e) => setUpi(e.target.value)}
        aria-invalid={upi.length > 0 && !upiValid}
      />
      {upi.length > 0 && !upiValid && (
        <p className="mt-1 text-xs text-red-600">
          Enter a valid UPI ID, like name@bank.
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        Any refund is sent to this UPI ID, so double-check it.
      </p>

      <label className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        I have read and understand the deposit and refund terms above.
      </label>

      <button type="submit" disabled={!canPay} className="btn-primary mt-5 w-full">
        {busy ? <Spinner className="h-5 w-5" /> : `Pay ₹${amount.toLocaleString()} deposit`}
      </button>

      <p className="mt-3 text-center text-xs text-muted">
        This is a separate payment from your service fee.
      </p>
    </form>
  );
}
