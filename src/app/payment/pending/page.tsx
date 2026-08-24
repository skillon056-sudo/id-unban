"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";
import { PaymentSummary, type PaymentInfo } from "@/components/PaymentSummary";

function PendingInner() {
  const orderId = useSearchParams().get("orderId") || "";
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Missing order reference.");
      return;
    }
    let active = true;
    let tries = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}`);
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(body.error || "Order not found.");
          return;
        }
        setInfo(body);
        if (body.status === "SUCCESS") {
          window.location.href = `/payment/success?orderId=${orderId}`;
          return;
        }
        if (body.status === "FAILED" || body.status === "CANCELLED") {
          window.location.href = `/payment/failed?orderId=${orderId}`;
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      // Poll up to ~2 minutes (24 x 5s), then stop.
      if (active && ++tries < 24) setTimeout(poll, 5000);
    }
    poll();
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-lg card p-8 text-center">
        <Spinner className="mx-auto h-8 w-8 text-amber-700" />
        <h1 className="mt-5 font-display text-2xl font-bold">Verifying Payment</h1>
        <p className="mt-2 text-sm text-muted">
          Your payment is currently being verified. Please wait while we confirm
          the transaction — this page updates automatically.
        </p>
        {error && <p className="mt-4 text-red-600">{error}</p>}
        {info && <PaymentSummary info={info} />}
        <div className="mt-8">
          <Link href="/" className="btn-ghost">Return to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<div className="container-x py-16 text-center"><Spinner /></div>}>
          <PendingInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
