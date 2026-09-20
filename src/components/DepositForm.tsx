"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { OpenInBrowser } from "./OpenInBrowser";
import { detectInApp } from "@/lib/in-app-browser";

// Same shape the server validates with — keep the two in step.
const PHONE_RE = /^[6-9]\d{9}$/;
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
  const [method, setMethod] = useState<"phone" | "upi">("phone");
  const [phone, setPhone] = useState("");
  const [upi, setUpi] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);

  const phoneValid = PHONE_RE.test(phone);
  const upiValid = UPI_RE.test(upi.trim().toLowerCase());
  const destinationValid = method === "phone" ? phoneValid : upiValid;
  const canPay = destinationValid && agreed && termsPublished && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPay) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          method === "phone"
            ? { orderId, phone }
            : { orderId, upiId: upi.trim().toLowerCase() },
        ),
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

      <span className="label">Where should the refund go?</span>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["phone", "upi"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              method === m
                ? "border-accent bg-accent/15 text-ink"
                : "border-border text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m === "phone" ? "Phone number" : "UPI ID"}
          </button>
        ))}
      </div>

      {method === "phone" ? (
        <>
          <input
            id="phone"
            required
            autoComplete="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
            aria-invalid={phone.length > 0 && !phoneValid}
          />
          {phone.length > 0 && !phoneValid && (
            <p className="mt-1 text-xs text-red-600">Enter a valid 10-digit mobile number.</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Any refund is sent to this number, so double-check it.
          </p>
        </>
      ) : (
        <>
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
            <p className="mt-1 text-xs text-red-600">Enter a valid UPI ID, like name@bank.</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Any refund is sent to this UPI ID, so double-check it.
          </p>
        </>
      )}

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
