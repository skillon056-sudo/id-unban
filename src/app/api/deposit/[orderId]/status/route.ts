import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Read-only status of the deposit belonging to a service order. It never
// credits anything — only the signed webhook settles a payment. This exists so
// the page the customer left open can tell when the deposit has gone through,
// because the gateway's checkout has no way to send them back.
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const deposit = await prisma.payment.findFirst({
    where: { parentOrderId: params.orderId, kind: "DEPOSIT" },
    orderBy: { createdAt: "desc" },
    select: { orderId: true, status: true, amount: true, currency: true },
  });

  if (!deposit) return NextResponse.json({ status: "NONE" });

  return NextResponse.json({
    status: deposit.status, // PENDING | SUCCESS | FAILED | CANCELLED
    depositOrderId: deposit.orderId,
    amount: deposit.amount,
    currency: deposit.currency,
  });
}
