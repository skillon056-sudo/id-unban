"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { identify, trackOnce } from "@/lib/pixel";

// The gateway has no return leg — its page just ends on "Payment Successful".
// So remember the order they left with, and pick the flow back up the moment
// they land on the site again, however they get here.
//
// This is also where the browser-side Purchase fires. The server already
// reported it from the webhook, but Meta matches a browser event to the visitor
// far better; both carry event_id = orderId, so Meta keeps only one.
const KEY = "ff_case";
const SENT_KEY = "ff_case_sent";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Called from the checkout form just before we hand the browser to the gateway. */
export function rememberCase(orderId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ orderId, t: Date.now() }));
  } catch {
    /* storage blocked — the banner is a convenience, not a requirement */
  }
}

interface Info {
  orderId: string;
  paid: boolean;
  depositNext: boolean;
}

export function ResumeCase() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let saved: { orderId?: string; t?: number } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return;
    }
    if (!saved?.orderId) return;

    // Stale entries disappear rather than nagging forever.
    if (!saved.t || Date.now() - saved.t > MAX_AGE_MS) {
      try {
        localStorage.removeItem(KEY);
      } catch {}
      return;
    }

    (async () => {
      const c = await fetch(`/api/appeal/${encodeURIComponent(saved!.orderId!)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!c?.orderId) return;

      const paid = c.paymentStatus === "SUCCESS";
      setInfo({ orderId: c.orderId, paid, depositNext: !!c.depositNext });
      if (!paid) return;

      // Report the conversion from the browser as well.
      try {
        const claim = await fetch(
          `/api/appeal/${encodeURIComponent(c.orderId)}/purchase-claim`,
          { method: "POST" },
        ).then((r) => r.json());

        if (claim.claimed) {
          identify(c.contactEmail);
          trackOnce(claim.eventId, "Purchase", {
            value: claim.value,
            currency: claim.currency,
            content_type: "product",
            content_ids: [c.gameId],
            contents: [{ id: c.gameId, quantity: 1, item_price: claim.value }],
          });
        }
      } catch {
        /* conversion reporting must never block the next step */
      }

      // Paid, deposit still owed → that's where they were headed. Once per
      // session, so dismissing or coming back later doesn't trap them in it.
      if (c.depositNext) {
        let sent = false;
        try {
          sent = sessionStorage.getItem(SENT_KEY) === c.orderId;
          sessionStorage.setItem(SENT_KEY, c.orderId);
        } catch {
          /* storage blocked — the banner button still gets them there */
        }
        if (!sent) {
          window.location.href = `/refundable-deposit?order=${encodeURIComponent(c.orderId)}`;
        }
      }
    })();
  }, []);

  if (!info) return null;

  function dismiss() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setInfo(null);
  }

  const href = info.depositNext
    ? `/refundable-deposit?order=${encodeURIComponent(info.orderId)}`
    : `/appeal/${info.orderId}`;

  return (
    <div className={info.paid ? "border-b border-emerald-200 bg-emerald-50" : "border-b border-accent/40 bg-accent/10"}>
      <div className="container-x flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-sm font-medium text-ink">
          {!info.paid ? (
            <>
              <span className="font-bold">Request in progress.</span> If you&apos;ve
              already paid, open it to see the latest status.
            </>
          ) : info.depositNext ? (
            <>
              <span className="font-bold">Payment received ✓</span> One step left to
              finish your request.
            </>
          ) : (
            <>
              <span className="font-bold">Payment received ✓</span> Your request is
              open — we&apos;ve started on it.
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <Link href={href} className="btn-primary px-4 py-2 text-sm">
            {info.depositNext ? "Continue" : "View my request"}
          </Link>
          <button onClick={dismiss} className="text-xs text-muted underline">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
