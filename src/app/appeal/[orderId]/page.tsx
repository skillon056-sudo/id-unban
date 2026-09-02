"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { GARENA_APPEAL_URL } from "@/lib/links";
import { identify, track } from "@/lib/pixel";

interface CaseInfo {
  orderId: string;
  gameId: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  transactionId: string | null;
  contactEmail: string | null;
  filedAt: string | null;
  createdAt: string;
}

const STEP_TEXT: Record<string, { title: string; body: string }> = {
  PENDING: {
    title: "Awaiting payment",
    body: "We haven't received your payment yet. Once it clears, we'll start preparing your appeal.",
  },
  IN_PROGRESS: {
    title: "We're preparing your appeal",
    body: "Your case is in our queue. We're putting together your appeal and will file it with Garena support.",
  },
  FILED: {
    title: "Appeal filed with Garena",
    body: "We've submitted your appeal. Garena reviews each case themselves — we'll follow up and email you any update.",
  },
  CLOSED: {
    title: "Case closed",
    body: "This case has been closed. Check your email for the final update from us.",
  },
  REJECTED: {
    title: "Case not opened",
    body: "Payment didn't complete, so no case was opened. You can try again from the home page.",
  },
};

export default function AppealCasePage({ params }: { params: { orderId: string } }) {
  const [info, setInfo] = useState<CaseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let tries = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/appeal/${encodeURIComponent(params.orderId)}`);
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(body.error || "Case not found.");
          return;
        }
        setInfo(body);

        // Confirmed paid → ask the server for permission to report it.
        // The claim is atomic in the DB, so only one caller ever wins.
        if (body.paymentStatus === "SUCCESS" && body.amount > 0) {
          try {
            const claim = await fetch(
              `/api/appeal/${encodeURIComponent(params.orderId)}/purchase-claim`,
              { method: "POST" },
            ).then((r) => r.json());

            if (claim.claimed) {
              identify(body.contactEmail);
              // Value and currency come from the verified payment record.
              track(
                "Purchase",
                {
                  value: claim.value,
                  currency: claim.currency,
                  content_type: "product",
                  content_ids: [body.gameId],
                  contents: [{ id: body.gameId, quantity: 1, item_price: claim.value }],
                },
                claim.eventId,
              );
              if (process.env.NODE_ENV !== "production") {
                console.log("[pixel] Purchase fired", claim);
              }
            }
          } catch {
            /* conversion reporting must never break the page */
          }
        }

        // Keep polling briefly while a payment is still settling.
        if (body.paymentStatus !== "SUCCESS" && ++tries < 40) setTimeout(poll, 3000);
      } catch {
        if (active && ++tries < 40) setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      active = false;
    };
  }, [params.orderId]);

  const step = info ? STEP_TEXT[info.status] ?? STEP_TEXT.PENDING : null;
  const paid = info?.paymentStatus === "SUCCESS" || info?.amount === 0;

  return (
    <>
      <Navbar />
      <main className="container-x py-16">
        <div className="mx-auto max-w-lg">
          {!info && !error && (
            <div className="card p-10 text-center">
              <Spinner className="mx-auto h-8 w-8 text-accent" />
            </div>
          )}
          {error && <div className="card p-8 text-center text-red-600">{error}</div>}

          {info && step && (
            <div className="card overflow-hidden">
              <div
                className={`px-8 pb-6 pt-10 text-center ${
                  paid ? "bg-gradient-to-b from-emerald-50 to-transparent" : "bg-gradient-to-b from-amber-50 to-transparent"
                }`}
              >
                <div
                  className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl shadow-card ${
                    paid ? "bg-emerald-500 text-white" : "bg-amber-400 text-ink"
                  }`}
                >
                  {paid ? "✓" : "…"}
                </div>
                <h1 className="mt-5 font-display text-2xl font-extrabold">{step.title}</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{step.body}</p>
              </div>

              <div className="px-8 pb-8">
                <div className="grid gap-3 text-sm">
                  <Row label="Free Fire ID" value={info.gameId} />
                  <Row label="Case reference" value={info.orderId} />
                  <Row
                    label="Amount"
                    value={info.amount === 0 ? "Free" : `₹${info.amount} ${info.currency}`}
                  />
                  {info.transactionId && <Row label="Transaction" value={info.transactionId} />}
                  <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
                    <span className="text-muted">Case status</span>
                    <StatusBadge status={info.status} />
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600">
                  Garena decides every ban appeal. We prepare and submit your case
                  and chase it up — we can&apos;t unban an account or guarantee a
                  result. You can also appeal yourself, free, at{" "}
                  <a
                    href={GARENA_APPEAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink underline"
                  >
                    Garena support
                  </a>
                  .
                </div>

                <p className="mt-4 text-center text-xs text-muted">
                  Save this link — it&apos;s how you check your case later.
                </p>
                <Link href="/" className="btn-ghost mt-4 w-full">Return to Home</Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
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
