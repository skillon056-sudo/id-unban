"use client";

import { useEffect, useState } from "react";
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
  // Set once the checkout is open: this page then watches for the payment,
  // since the gateway's own page has no way to send anyone back.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [payFailed, setPayFailed] = useState(false);

  const phoneValid = PHONE_RE.test(phone);
  const upiValid = UPI_RE.test(upi.trim().toLowerCase());
  const destinationValid = method === "phone" ? phoneValid : upiValid;
  const canPay = destinationValid && agreed && termsPublished && !busy;

  // Poll the deposit's status while the customer is on the gateway. The webhook
  // is what actually settles it; this only decides when to move the page on.
  useEffect(() => {
    if (!waitingFor) return;
    let stop = false;
    const until = Date.now() + 10 * 60 * 1000;

    async function tick() {
      if (stop || Date.now() > until) return;
      try {
        const s = await fetch(`/api/deposit/${encodeURIComponent(orderId)}/status`).then((r) =>
          r.json(),
        );
        if (stop) return;
        if (s.status === "SUCCESS") {
          window.location.href = `/appeal/${encodeURIComponent(orderId)}`;
          return;
        }
        if (s.status === "FAILED" || s.status === "CANCELLED") {
          setPayFailed(true);
          setWaitingFor(null);
          return;
        }
      } catch {
        /* keep watching */
      }
      setTimeout(tick, 2000);
    }
    tick();

    // Returning to this tab should check straight away.
    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [waitingFor, orderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPay) return;
    setBusy(true);
    setError(null);
    setPayFailed(false);

    // Claimed while the click is still a trusted gesture; after the await a
    // popup blocker would refuse. Null means blocked, and we offer a link.
    let payTab: Window | null = null;
    try {
      payTab = window.open("", "_blank");
    } catch {
      payTab = null;
    }
    const dropTab = () => {
      try {
        payTab?.close();
      } catch {
        /* nothing to do */
      }
      payTab = null;
    };

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
        dropTab();
        setError(body.error || "Could not continue. Please try again.");
        setBusy(false);
        return;
      }
      // In-app browsers can't reach a UPI app — hand off instead of dead-ending.
      if (body.redirectUrl.startsWith("http") && detectInApp().isInApp) {
        dropTab();
        setHandoffUrl(body.redirectUrl);
        setBusy(false);
        return;
      }

      // Checkout goes to its own tab; this one stays and watches for the
      // payment. If the tab was blocked, the link below opens it on a click.
      if (payTab) payTab.location.href = body.redirectUrl;
      setWaitingFor(body.redirectUrl);
      setBusy(false);
    } catch {
      dropTab();
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (handoffUrl) return <OpenInBrowser url={handoffUrl} />;

  if (waitingFor) {
    return (
      <div className="mt-6 rounded-xl border border-accent/60 bg-accent/10 p-5 text-center">
        <Spinner className="mx-auto h-6 w-6 text-ink" />
        <p className="mt-3 text-sm font-semibold text-ink">Waiting for your payment…</p>
        <p className="mt-1 text-xs text-muted">
          Finish the payment in the other tab. This page updates by itself — don&apos;t
          close it.
        </p>
        <a
          href={waitingFor}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost mt-3 inline-flex text-sm"
        >
          Payment page didn&apos;t open? Tap here
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6">
      {payFailed && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          That payment didn&apos;t go through. You can try again below.
        </div>
      )}
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
