import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";
import { getSettings } from "@/lib/settings";
import { inrToUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const orderId = params.orderId;
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // If still pending, poll the gateway once as a fallback for a late webhook.
  if (payment.status === "PENDING") {
    try {
      const v = await getGateway().verifyPayment(orderId);
      if (v.status !== "PENDING") await settlePayment(v);
    } catch {
      /* keep showing PENDING on transient errors */
    }
  }

  const fresh = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      gameId: true,
      amount: true,
      currency: true,
      status: true,
      transactionId: true,
    },
  });
  const request = await prisma.unbanRequest.findFirst({
    where: { orderId },
    select: { status: true },
  });

  const settings = await getSettings();
  const amountUsd = fresh ? inrToUsd(fresh.amount, settings.usd_rate || "83") : 0;

  return NextResponse.json({ ...fresh, amountUsd, requestStatus: request?.status ?? "PENDING" });
}
