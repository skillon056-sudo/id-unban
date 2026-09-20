import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DepositForm } from "@/components/DepositForm";
import { AccountQuestions } from "@/components/AccountQuestions";
import { TermsBlock } from "@/components/TermsBlock";
import { depositOpensAt } from "@/lib/deposit";
import { DepositCountdown } from "@/components/DepositCountdown";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Deposit",
  robots: { index: false, follow: false },
};

// Only reachable with a service order the server has already verified as paid.
// The order id arrives in the query string; nothing sensitive is exposed by it.
export default async function DepositPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderId = (searchParams.order ?? "").trim();
  if (!orderId) redirect("/");

  const [payment, settings] = await Promise.all([
    prisma.payment.findUnique({
      where: { orderId },
      select: { status: true, kind: true, gameId: true, updatedAt: true },
    }),
    getSettings(),
  ]);

  // Unverified or unknown order → no deposit flow.
  if (!payment || payment.kind !== "SERVICE" || payment.status !== "SUCCESS") {
    redirect("/");
  }
  if (settings.deposit_enabled !== "true") redirect(`/appeal/${orderId}`);
  // Not open yet — the case page shows how long is left.
  if (Date.now() < depositOpensAt(payment.updatedAt, settings).getTime()) {
    redirect(`/appeal/${orderId}`);
  }

  const amount = Math.round(Number(settings.deposit_amount || 2000));
  const currency = settings.currency || "INR";
  const terms = settings.deposit_terms || "";
  const termsEn = settings.deposit_terms_en || "";
  const support = settings.support_contact || "";
  const note = settings.deposit_note || "";
  const voice = settings.deposit_voice_url || "";

  // Countdown for this step. Starts the first time the customer opens the page
  // — not when the payment cleared — so it is genuinely the time they had.
  // 0 minutes switches it off.
  const timerMinutes = Math.max(0, Math.round(Number(settings.deposit_timer_minutes ?? 25)));
  let deadline: Date | null = null;
  if (timerMinutes > 0) {
    const req = await prisma.unbanRequest.findUnique({
      where: { orderId },
      select: { depositSeenAt: true },
    });
    let seen = req?.depositSeenAt ?? null;
    if (!seen) {
      seen = new Date();
      await prisma.unbanRequest.update({ where: { orderId }, data: { depositSeenAt: seen } });
    }
    deadline = new Date(seen.getTime() + timerMinutes * 60 * 1000);
  }
  const expired = deadline != null && Date.now() >= deadline.getTime();

  // Already paid? Send them to the case page instead of charging twice.
  const existing = await prisma.payment.findFirst({
    where: { parentOrderId: orderId, kind: "DEPOSIT", status: "SUCCESS" },
    select: { orderId: true },
  });
  if (existing) redirect(`/appeal/${orderId}`);

  return (
    <>
      <Navbar />
      <main className="container-x py-12">
        <div className="mx-auto max-w-lg">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-b from-accent/20 to-transparent px-8 pb-6 pt-10 text-center">
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-muted">
                Step 2 of 2
              </p>
              <h1 className="mt-3 font-display text-2xl font-extrabold">
                Refundable Security Deposit
              </h1>
              <p className="mt-4 font-display text-4xl font-extrabold text-ink">
                ₹{amount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">{currency}</p>
            </div>

            <div className="px-8 pb-8">
              <p className="text-sm leading-relaxed text-slate-700">
                To continue with your request, a refundable security deposit of{" "}
                <span className="font-semibold text-ink">₹{amount.toLocaleString()}</span> is
                required for Free Fire ID{" "}
                <span className="font-mono font-semibold text-ink">{payment.gameId}</span>.
              </p>

              {/* Operator-written policy. Nothing here is invented by the app. */}
              {terms ? (
                <TermsBlock primary={terms} alternate={termsEn} support={support} />
              ) : (
                <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
                  Refund terms have not been published yet. Please contact support
                  {support ? ` at ${support}` : ""} before paying.
                </div>
              )}

              {voice && (
                <div className="mt-3 rounded-xl border border-border bg-slate-100 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                    Voice note
                  </p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={voice} controls preload="none" className="w-full" />
                </div>
              )}

              {note && (
                <p className="mt-5 whitespace-pre-line rounded-xl border border-border bg-white p-4 text-sm leading-relaxed text-slate-700">
                  {note}
                </p>
              )}

              {expired ? (
                <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-semibold">Time for this step has run out.</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Nothing has been charged. Contact
                    {support ? ` ${support}` : " support"} with your reference{" "}
                    <span className="font-mono font-semibold">{orderId}</span> and we&apos;ll
                    reopen it for you.
                  </p>
                </div>
              ) : (
                <>
                  {deadline && <DepositCountdown deadline={deadline.toISOString()} />}
                  <AccountQuestions orderId={orderId}>
                    <DepositForm
                      orderId={orderId}
                      amount={amount}
                      termsPublished={Boolean(terms)}
                    />
                  </AccountQuestions>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
