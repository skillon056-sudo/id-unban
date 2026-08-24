import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";

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

  return NextResponse.json({ ...fresh, requestStatus: request?.status ?? "PENDING" });
}
