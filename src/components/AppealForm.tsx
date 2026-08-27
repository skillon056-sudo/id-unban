"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import { OpenInBrowser } from "./OpenInBrowser";
import { detectInApp } from "@/lib/in-app-browser";
import { identify, track } from "@/lib/pixel";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appeal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, contactEmail: email }),
      });
      const body = await res.json();
      if (!res.ok || !body.redirectUrl) {
        setError(body.error || "Could not continue. Please try again.");
        setBusy(false);
        return;
      }
      // Checkout started — attribute it to this customer.
      identify(email);
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

      // Relative URLs are our own pages and work fine in any browser.
      const external = body.redirectUrl.startsWith("http");
      if (external && detectInApp().isInApp) {
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
