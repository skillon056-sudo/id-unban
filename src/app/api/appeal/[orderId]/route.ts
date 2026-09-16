import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";
import { depositOpensAt } from "@/lib/deposit";

export const dynamic = "force-dynamic";

// Case status for the customer. Read-only: never marks anything paid itself.
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const orderId = params.orderId;
  const payment = await prisma.payment.findUnique({ where: { orderId } });

  // Fallback poll in case the webhook is delayed.
  if (payment?.status === "PENDING") {
    try {
      const v = await getGateway().verifyPayment(orderId);
      if (v.status !== "PENDING") await settlePayment(v);
    } catch {
      /* keep showing PENDING */
    }
  }

  const c = await prisma.unbanRequest.findUnique({
    where: { orderId },
    select: {
      orderId: true, gameId: true, amount: true, currency: true, contactEmail: true,
      status: true, filedAt: true, createdAt: true,
    },
  });
  if (!c) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const fresh = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, transactionId: true, updatedAt: true },
  });

  // Is there a deposit step still to do for this order?
  const settings = await getSettings();
  const depositPaid = await prisma.payment.findFirst({
    where: { parentOrderId: orderId, kind: "DEPOSIT", status: "SUCCESS" },
    select: { orderId: true },
  });
  const depositNext =
    settings.deposit_enabled === "true" &&
    fresh?.status === "SUCCESS" &&
    !depositPaid;

  return NextResponse.json({
    ...c,
    depositNext,
    // Settlement is the payment's last write, so updatedAt is when it cleared.
    depositAt: depositNext && fresh ? depositOpensAt(fresh.updatedAt, settings).toISOString() : null,
    // Operator-written heading and line for a paid case; empty = built-in text.
    progressTitle: settings.progress_title || null,
    progressBody: settings.progress_body || null,
    caseNotice: settings.case_notice || null,
    paymentStatus: fresh?.status ?? (c.amount === 0 ? "FREE" : "UNKNOWN"),
    transactionId: fresh?.transactionId ?? null,
  });
}
