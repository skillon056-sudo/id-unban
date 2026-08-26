"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";
import { GARENA_APPEAL_URL } from "@/lib/links";

interface RequestInfo {
  orderId: string;
  gameId: string;
  status: string;
  createdAt: string;
}

function SubmittedInner() {
  const ref = useSearchParams().get("ref") || "";
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setError("Missing request reference.");
      return;
    }
    fetch(`/api/request/status/${encodeURIComponent(ref)}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setInfo(b) : setError(b.error || "Request not found.")))
      .catch(() => setError("Could not load your request."));
  }, [ref]);

  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-lg">
        {!info && !error && (
          <div className="card p-10 text-center">
            <Spinner className="mx-auto h-8 w-8 text-accent" />
          </div>
        )}
        {error && <div className="card p-8 text-center text-red-600">{error}</div>}

        {info && (
          <div className="card overflow-hidden text-center">
            <div className="bg-gradient-to-b from-emerald-50 to-transparent px-8 pb-6 pt-10">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-4xl text-white shadow-card">
                ✓
              </div>
              <h1 className="mt-5 font-display text-2xl font-extrabold">Request Recorded</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                We&apos;ve saved your request. To actually appeal the ban, you must
                submit it through Garena&apos;s official support — it&apos;s free.
              </p>
            </div>

            <div className="mx-8 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-widest text-muted">Free Fire ID</p>
              <p className="font-display text-2xl font-bold tracking-wide">{info.gameId}</p>
            </div>

            <div className="px-8 pb-8">
              <div className="mt-6 grid gap-3 text-left text-sm">
                <Row label="Reference" value={info.orderId} />
                <Row label="Status" value="Recorded" />
                <Row label="Cost" value="Free" />
              </div>

              <div className="mt-6 rounded-xl border border-accent/40 bg-accent/10 p-4 text-left">
                <p className="text-sm font-semibold text-ink">Next step — official appeal</p>
                <p className="mt-1 text-xs text-muted">
                  Garena reviews and lifts bans only through their own support channel.
                  There is no charge for submitting an appeal.
                </p>
                <a
                  href={GARENA_APPEAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-3 w-full text-sm"
                >
                  Open Garena Support
                </a>
              </div>

              <Link href="/" className="btn-ghost mt-4 w-full">Return to Home</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function RequestSubmittedPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<div className="container-x py-16 text-center"><Spinner /></div>}>
          <SubmittedInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
