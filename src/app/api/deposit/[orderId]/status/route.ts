import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";

export const dynamic = "force-dynamic";

// Status of the deposit belonging to a service order. It never credits on its
// own say — a pending one is re-asked of the gateway, like the case page does,
// because Rupayex has no signed webhook. This exists so
// the page the customer left open can tell when the deposit has gone through,
// because the gateway's checkout has no way to send them back.
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  // Every click on Pay mints a new deposit order, so there can be several rows
  // for one service order. A paid one wins: reporting merely the newest would
  // leave the page waiting forever when the customer paid an earlier link.
  const select = { orderId: true, status: true, amount: true, currency: true } as const;
  const deposit =
    (await prisma.payment.findFirst({
      where: { parentOrderId: params.orderId, kind: "DEPOSIT", status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      select,
    })) ??
    (await prisma.payment.findFirst({
      where: { parentOrderId: params.orderId, kind: "DEPOSIT" },
      orderBy: { createdAt: "desc" },
      select,
    }));

  if (!deposit) return NextResponse.json({ status: "NONE" });

  if (deposit.status === "PENDING") {
    try {
      const v = await getGateway().verifyPayment(deposit.orderId);
      if (v.status !== "PENDING") deposit.status = (await settlePayment(v)).status;
    } catch {
      /* keep showing PENDING */
    }
  }

  return NextResponse.json({
    status: deposit.status, // PENDING | SUCCESS | FAILED | CANCELLED
    depositOrderId: deposit.orderId,
    amount: deposit.amount,
    currency: deposit.currency,
  });
}
