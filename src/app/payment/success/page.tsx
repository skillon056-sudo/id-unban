"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";
import { PaymentSummary, type PaymentInfo } from "@/components/PaymentSummary";

function SuccessInner() {
  const orderId = useSearchParams().get("orderId") || "";
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Missing order reference.");
      return;
    }
    fetch(`/api/payment/status/${encodeURIComponent(orderId)}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setInfo(b) : setError(b.error || "Order not found.")))
      .catch(() => setError("Could not load order status."));
  }, [orderId]);

  const verified = info?.status === "SUCCESS";
  const free = verified && info?.amount === 0;

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-lg">
        {!info && !error && (
          <div className="card p-10 text-center">
            <Spinner className="mx-auto h-8 w-8 text-accent" />
            <p className="mt-4 text-sm text-muted">Loading your request…</p>
          </div>
        )}
        {error && <div className="card p-8 text-center text-red-600">{error}</div>}

        {info && (
          <div className="card overflow-hidden text-center">
            {/* Header band */}
            <div
              className={`px-8 pb-8 pt-10 ${
                verified ? "bg-gradient-to-b from-emerald-50 to-transparent" : "bg-gradient-to-b from-amber-50 to-transparent"
              }`}
            >
              <div
                className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl shadow-card ${
                  verified ? "bg-emerald-500 text-white" : "bg-amber-400 text-ink"
                }`}
              >
                {verified ? "✓" : "…"}
              </div>
              <h1 className="mt-5 font-display text-2xl font-extrabold">
                {free
                  ? "Unban Request Submitted 🎉"
                  : verified
                    ? "Payment Successful 🎉"
                    : "Payment Processing"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                {verified
                  ? free
                    ? "Your FREE unban request has been submitted successfully and is now queued for review."
                    : "Your payment has been verified and your unban request has been submitted for review."
                  : "We haven’t confirmed this payment yet. See the pending page for live status."}
              </p>
            </div>

            {/* Highlighted Free Fire ID */}
            <div className="mx-8 -mt-2 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-widest text-muted">Free Fire ID</p>
              <p className="font-display text-2xl font-bold tracking-wide">{info.gameId}</p>
            </div>

            <div className="px-8 pb-8">
              <PaymentSummary info={info} />
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                {!verified && (
                  <Link href={`/payment/pending?orderId=${orderId}`} className="btn-ghost">
                    View pending status
                  </Link>
                )}
                <Link href="/" className="btn-primary">Return to Home</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<div className="container-x py-16 text-center"><Spinner /></div>}>
          <SuccessInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
