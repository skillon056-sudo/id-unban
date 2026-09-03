"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The gateway has no way to send a payer back to us — its page just ends on
// "Payment Successful". So remember the order they left with, and put it back
// in front of them the moment they return, however they return.
const KEY = "ff_case";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Called from the checkout form just before we hand the browser to the gateway. */
export function rememberCase(orderId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ orderId, t: Date.now() }));
  } catch {
    /* storage blocked — the banner is a convenience, not a requirement */
  }
}

export function ResumeCase() {
  const [state, setState] = useState<{ orderId: string; paid: boolean } | null>(null);

  useEffect(() => {
    let saved: { orderId?: string; t?: number } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return;
    }
    if (!saved?.orderId) return;

    // Stale entries just disappear rather than nagging forever.
    if (!saved.t || Date.now() - saved.t > MAX_AGE_MS) {
      try {
        localStorage.removeItem(KEY);
      } catch {}
      return;
    }

    fetch(`/api/appeal/${encodeURIComponent(saved.orderId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b?.orderId) return;
        setState({ orderId: b.orderId, paid: b.paymentStatus === "SUCCESS" });
      })
      .catch(() => {});
  }, []);

  if (!state) return null;

  function dismiss() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setState(null);
  }

  return (
    <div className={state.paid ? "border-b border-emerald-200 bg-emerald-50" : "border-b border-accent/40 bg-accent/10"}>
      <div className="container-x flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-sm font-medium text-ink">
          {state.paid ? (
            <>
              <span className="font-bold">Payment received ✓</span> Your request is
              open — we&apos;ve started on it.
            </>
          ) : (
            <>
              <span className="font-bold">Request in progress.</span> If you&apos;ve
              already paid, open it to see the latest status.
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <Link href={`/appeal/${state.orderId}`} className="btn-primary px-4 py-2 text-sm">
            View my request
          </Link>
          <button onClick={dismiss} className="text-xs text-muted underline">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
