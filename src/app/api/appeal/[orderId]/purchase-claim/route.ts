import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Claims the right to report the Purchase conversion for this order, exactly
// once, at the database level. Refreshes, extra tabs, the back button and
// webhook retries all lose the race and get { claimed: false }.
//
// Only a server-verified SUCCESS payment can be claimed — the client cannot
// talk its way into a conversion.
export async function POST(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const orderId = params.orderId;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, amount: true, currency: true },
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

  // Amount/currency come from the verified payment row, never from the client.
  return NextResponse.json({
    claimed: true,
    value: payment.amount,
    currency: payment.currency,
    eventId: orderId,
  });
}
