import { prisma } from "@/lib/db";
import { sendPurchaseToMeta } from "./meta-capi";

/**
 * Reports the Purchase conversion to Meta at most once per order. The DB flag
 * is the claim: whoever flips it sends.
 *
 * Called from settlement — most customers pay inside their UPI app and never
 * return to the site, so a browser-only trigger silently loses the conversion —
 * and from the browser claim route, which can add fbp/fbc when the tab is
 * still open and settlement's send failed.
 */
export async function reportPurchaseOnce(
  orderId: string,
  extra: {
    clientIp?: string | null;
    userAgent?: string | null;
    fbp?: string | null;
    fbc?: string | null;
  } = {},
): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, amount: true, currency: true, gameId: true, kind: true },
  });

  if (!payment || payment.status !== "SUCCESS" || payment.amount <= 0) return false;
  if (payment.kind === "DEPOSIT") return false; // held, not revenue

  // Atomic compare-and-set — only the first caller sends.
  const claim = await prisma.unbanRequest.updateMany({
    where: { orderId, purchaseReported: false },
    data: { purchaseReported: true },
  });
  if (claim.count !== 1) return false;

  const request = await prisma.unbanRequest.findUnique({
    where: { orderId },
    select: { contactEmail: true, attribution: true },
  });

  // Whatever the live browser gave us wins; otherwise fall back to what was
  // captured at checkout, which is all we have for a payer who never came back.
  let saved: { fbc?: string; fbp?: string; ip?: string; ua?: string } = {};
  try {
    saved = JSON.parse(request?.attribution ?? "{}") ?? {};
  } catch {
    /* unreadable — send what we have */
  }
  const identifiers = {
    fbc: extra.fbc ?? saved.fbc ?? null,
    fbp: extra.fbp ?? saved.fbp ?? null,
    clientIp: extra.clientIp ?? saved.ip ?? null,
    userAgent: extra.userAgent ?? saved.ua ?? null,
  };

  const sent = await sendPurchaseToMeta({
    eventId: orderId,
    value: payment.amount,
    currency: payment.currency,
    contentId: payment.gameId,
    email: request?.contactEmail,
    sourceUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/appeal/${orderId}`,
    ...identifiers,
  });

  // A transient Meta failure must not burn the conversion — release the claim
  // so the next arrival (browser, or a webhook retry) tries again.
  if (!sent) {
    await prisma.unbanRequest.updateMany({
      where: { orderId },
      data: { purchaseReported: false },
    });
  }
  return sent;
}
