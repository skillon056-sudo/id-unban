"use client";

// DEV-ONLY simulated checkout for PAYMENT_GATEWAY=mock.
// The real Sunpay hosted checkout replaces this page entirely.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";

function MockInner() {
  const orderId = useSearchParams().get("orderId") || "";
  const [busy, setBusy] = useState(false);

  async function complete(outcome: "success" | "cancelled") {
    if (!orderId) return;
    setBusy(true);
    // Simulate the gateway -> our webhook call (server-side settlement).
    await fetch("/api/payment/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, outcome }),
    }).catch(() => {});
    window.location.href =
      outcome === "success"
        ? `/payment/success?orderId=${orderId}`
        : `/payment/failed?orderId=${orderId}`;
  }

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-md card p-8 text-center">
        <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
          Sandbox checkout
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Simulated Payment</h1>
        <p className="mt-2 text-sm text-muted">
          This is a mock gateway for local development. Order:
        </p>
        <p className="mt-2 font-mono text-sm text-slate-700">{orderId || "—"}</p>

        <div className="mt-8 flex flex-col gap-3">
          <button onClick={() => complete("success")} disabled={busy} className="btn-primary">
            {busy ? <Spinner className="h-5 w-5" /> : "Pay now (simulate success)"}
          </button>
          <button onClick={() => complete("cancelled")} disabled={busy} className="btn-ghost">
            Cancel payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={null}>
          <MockInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
