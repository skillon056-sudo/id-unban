import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";
import { sendPurchaseToMeta } from "@/services/meta-capi";

export const dynamic = "force-dynamic";

// Claims the right to report the Purchase conversion for this order, exactly
// once, at the database level. Refreshes, extra tabs, the back button and
// webhook retries all lose the race and get { claimed: false }.
//
// Only a server-verified SUCCESS payment can be claimed — the client cannot
// talk its way into a conversion, and the amount always comes from the
// payment row rather than anything the browser sent.
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  const orderId = params.orderId;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, amount: true, currency: true, gameId: true },
  });

  if (!payment || payment.status !== "SUCCESS" || payment.amount <= 0) {
    return NextResponse.json({ claimed: false, reason: "not a verified paid order" });
  }

  // Atomic compare-and-set: only the first caller flips the flag.
  const claim = await prisma.unbanRequest.updateMany({
    where: { orderId, purchaseReported: false },
    data: { purchaseReported: true },
  });

  if (claim.count !== 1) {
    return NextResponse.json({ claimed: false, reason: "already reported" });
  }

  console.log(`[purchase] claimed order=${orderId} amount=${payment.amount} ${payment.currency}`);

  // Mirror the event server-side. Same event_id as the browser pixel, so Meta
  // counts it once even when both arrive — and it still lands if the browser
  // pixel was blocked or the tab was closed.
  const request = await prisma.unbanRequest.findUnique({
    where: { orderId },
    select: { contactEmail: true },
  });

  const cookies = req.headers.get("cookie") ?? "";
  const cookie = (name: string) =>
    cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null;

  await sendPurchaseToMeta({
    eventId: orderId,
    value: payment.amount,
    currency: payment.currency,
    contentId: payment.gameId,
    email: request?.contactEmail,
    clientIp: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc"),
    sourceUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/appeal/${orderId}`,
  });

  return NextResponse.json({
    claimed: true,
    value: payment.amount,
    currency: payment.currency,
    eventId: orderId,
  });
}
