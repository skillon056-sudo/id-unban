"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import { OpenInBrowser } from "./OpenInBrowser";
import { detectInApp } from "@/lib/in-app-browser";
import { identify, track } from "@/lib/pixel";
import { rememberCase } from "./ResumeCase";

// Minimal intake: just the email we need to deliver the service and report
// back. Everything else is collected over email once the case is open.
export function AppealForm({
  gameId,
  fee,
  onCancel,
}: {
  gameId: string;
  fee: number | null;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when we can't redirect here (in-app browser) — user finishes elsewhere.
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // While the customer is on the gateway, this page watches for the payment —
  // the gateway's checkout has no way to send anyone back.
  const [waiting, setWaiting] = useState<{ orderId: string; url: string } | null>(null);
  const payTabRef = useRef<Window | null>(null);

  function closePayTab() {
    try {
      payTabRef.current?.close();
    } catch {
      /* already gone, or the browser refused */
    }
    payTabRef.current = null;
    try {
      window.focus();
    } catch {
      /* best effort */
    }
  }

  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const until = Date.now() + 10 * 60 * 1000;

    async function tick() {
      if (stop || Date.now() > until) return;
      try {
        const s = await fetch(`/api/appeal/${encodeURIComponent(waiting!.orderId)}`).then((r) =>
          r.json(),
        );
        if (stop) return;
        if (s.paymentStatus === "SUCCESS") {
          closePayTab();
          // The case page reports the conversion and runs the next step.
          window.location.href = `/appeal/${encodeURIComponent(waiting!.orderId)}`;
          return;
        }
      } catch {
        /* keep watching */
      }
      setTimeout(tick, 2000);
    }
    tick();

    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [waiting]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Claim a tab now, while the click is still a trusted gesture — after the
    // await below a browser would treat window.open as a popup and block it.
    // Null means it was blocked anyway, and we fall back to this tab.
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
      const res = await fetch("/api/appeal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Carried from the ad link so the conversion can be tied back to it
        // even if the pixel never got to write its cookie.
        body: JSON.stringify({
          gameId,
          contactEmail: email,
          fbclid: new URLSearchParams(window.location.search).get("fbclid") ?? undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        dropTab();
        setError(body.error || "Could not continue. Please try again.");
        setBusy(false);
        return;
      }
      identify(email);

      // A returning customer being sent back to an unfinished step isn't
      // starting a checkout — reporting one would inflate the funnel.
      if (body.resumed) {
        dropTab(); // an internal page, no gateway involved
        setRedirecting(true);
        window.location.href = body.redirectUrl;
        return;
      }

      // Checkout started — attribute it to this customer.
      track(
        "InitiateCheckout",
        {
          value: fee ?? 0,
          currency: "INR",
          content_type: "product",
          content_ids: [gameId],
          contents: [{ id: gameId, quantity: 1, item_price: fee ?? 0 }],
        },
        body.orderId,
      );

      // Leave a mark in the access log for which way this checkout went, so a
      // drop in payments can be told apart: people stuck on the hand-off screen
      // versus people who reached the gateway and didn't pay. keepalive lets it
      // survive the navigation that follows.
      const mark = (event: string) =>
        fetch(`/api/appeal/${encodeURIComponent(body.orderId)}?event=${event}`, {
          keepalive: true,
        }).catch(() => {});

      // Relative URLs are our own pages and work fine in any browser.
      const external = body.redirectUrl.startsWith("http");
      if (external && detectInApp().isInApp) {
        dropTab(); // the hand-off screen drives the browser itself
        mark("handoff");
        rememberCase(body.orderId);
        setHandoffUrl(body.redirectUrl);
        setBusy(false);
        return;
      }
      mark("gateway");
      rememberCase(body.orderId);
      setRedirecting(true);

      // The gateway's checkout ends on its own success screen — it has no way
      // to send anyone back to us. So send it to its own tab and keep this one
      // alive on the case page, where it polls and moves itself on to the next
      // step the moment the payment settles. Closing the payment tab then lands
      // the customer on a page that has already advanced.
      if (payTab) {
        payTab.location.href = body.redirectUrl;
        payTabRef.current = payTab;
        // Stay here and watch, so the checkout tab can be closed when it lands.
        setWaiting({ orderId: body.orderId, url: body.redirectUrl });
        setBusy(false);
        return;
      }
      // Popup blocked. Don't hand this tab to the gateway — that is the tab
      // that watches for the payment and moves on afterwards. Carry the
      // checkout link to the case page, which offers it as a button: a click
      // there is a fresh gesture, so that window always opens.
      window.location.href =
        `/appeal/${encodeURIComponent(body.orderId)}?pay=${encodeURIComponent(body.redirectUrl)}`;
    } catch {
      dropTab();
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (handoffUrl) return <OpenInBrowser url={handoffUrl} />;

  if (waiting) {
    return (
      <div className="mt-4 rounded-xl border border-accent/60 bg-accent/10 p-5 text-center animate-fade-up">
        <Spinner className="mx-auto h-6 w-6 text-ink" />
        <p className="mt-3 text-sm font-semibold text-ink">Waiting for your payment…</p>
        <p className="mt-1 text-xs text-muted">
          Finish the payment in the other tab. This page updates by itself — don&apos;t
          close it.
        </p>
        <a
          href={waiting.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost mt-3 inline-flex text-sm"
        >
          Payment page didn&apos;t open? Tap here
        </a>
      </div>
    );
  }

  // The gateway page takes a moment to appear; show progress instead of a
  // dead-looking button while the browser navigates away.
  if (redirecting) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 p-4 animate-fade-up">
        <Spinner className="h-5 w-5 text-ink" />
        <div>
          <p className="text-sm font-semibold text-ink">Opening secure payment…</p>
          <p className="text-xs text-muted">Don&apos;t close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 animate-fade-up">
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <label className="label" htmlFor="a-email">
        Your email — we send case updates here
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="a-email"
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="input flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? (
            <Spinner className="h-5 w-5" />
          ) : fee == null ? (
            "Continue"
          ) : (
            `Pay ₹${fee}`
          )}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
