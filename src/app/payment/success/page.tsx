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

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-lg card p-8 text-center">
        {!info && !error && <Spinner className="mx-auto h-8 w-8 text-accent" />}
        {error && <p className="text-red-600">{error}</p>}
        {info && (
          <>
            <div
              className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${
                verified ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
              }`}
            >
              {verified ? "✓" : "…"}
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">
              {verified ? "Payment Successful" : "Payment Processing"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {verified
                ? "Your payment has been successfully verified and your unban request has been submitted for review."
                : "We haven’t confirmed this payment yet. Check the pending page for live status."}
            </p>
            <PaymentSummary info={info} />
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {!verified && (
                <Link href={`/payment/pending?orderId=${orderId}`} className="btn-ghost">
                  View pending status
                </Link>
              )}
              <Link href="/" className="btn-primary">Return to Home</Link>
            </div>
          </>
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
