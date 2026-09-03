import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";
import { readCookie } from "@/lib/cookies";
import { reportPurchaseOnce } from "@/services/report-purchase";

export const dynamic = "force-dynamic";

// Tells the browser whether this order is a real, server-verified purchase and
// what to report — the amount always comes from the payment row, never from
// anything the browser sent.
//
// The server-side CAPI mirror is claimed once in the DB (usually already done
// by settlement). The browser pixel is NOT gated on that claim: both events
// carry event_id = orderId, so Meta merges them, and the client's trackOnce
// keeps refreshes and extra tabs from firing twice.
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  const orderId = params.orderId;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, amount: true, currency: true, kind: true },
  });

  if (
    !payment ||
    payment.status !== "SUCCESS" ||
    payment.amount <= 0 ||
    payment.kind === "DEPOSIT"
  ) {
    return NextResponse.json({ claimed: false, reason: "not a verified paid order" });
  }

  // No-op when settlement already sent it; retries if that send had failed.
  await reportPurchaseOnce(orderId, {
    clientIp: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    fbp: readCookie(req, "_fbp"),
    fbc: readCookie(req, "_fbc"),
  });

  return NextResponse.json({
    claimed: true,
    value: payment.amount,
    currency: payment.currency,
    eventId: orderId,
  });
}
