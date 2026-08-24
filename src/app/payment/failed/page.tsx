"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

function FailedInner() {
  const orderId = useSearchParams().get("orderId") || "";
  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-lg card p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-3xl text-red-600">
          ✕
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Payment Failed</h1>
        <p className="mt-2 text-sm text-muted">
          Your payment could not be completed. No unban request was submitted.
        </p>
        {orderId && (
          <p className="mt-4 rounded-xl bg-slate-100 p-3 font-mono text-sm text-slate-700">
            Order: {orderId}
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/#check" className="btn-primary">Retry Payment</Link>
          <Link href="/" className="btn-ghost">Return to Home</Link>
        </div>
      </div>
    </div>
  );
}

export default function FailedPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={null}>
          <FailedInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
