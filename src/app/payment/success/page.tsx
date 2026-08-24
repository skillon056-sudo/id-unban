"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";
import { PaymentSummary, type PaymentInfo } from "@/components/PaymentSummary";

function Countdown({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="mx-8 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs uppercase tracking-widest text-emerald-700">Account will be unbanned within</p>
      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-emerald-700">
        {mm}:{ss}
      </p>
    </div>
  );
}

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
            <div
              className={`px-8 pb-6 pt-10 ${
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
                {verified ? "ID Unbanned Successfully" : "Payment Processing"}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                {verified
                  ? "Your Free Fire ID has been unbanned successfully. Please wait for the timer to complete before logging in."
                  : "We haven’t confirmed this payment yet. See the pending page for live status."}
              </p>
            </div>

            {verified && <Countdown minutes={30} />}

            {/* Highlighted Free Fire ID */}
            <div className="mx-8 mt-4 rounded-xl border border-border bg-surface p-4">
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
