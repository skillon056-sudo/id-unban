import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Auth enforced by middleware for /api/admin/*.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.toUpperCase() || "ALL";
  const search = url.searchParams.get("search")?.trim() || "";

  const where: Prisma.RefundWhereInput = {};
  if (["NOT_REQUESTED", "PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { orderId: { contains: search } },
      { gameId: { contains: search } },
      { upiId: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }

  const items = await prisma.refund.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Only deposits that actually cleared are refundable.
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: items.map((i) => i.orderId) } },
    select: { orderId: true, status: true, transactionId: true, parentOrderId: true },
  });
  const byOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));

  return NextResponse.json({
    items: items.map((r) => ({
      ...r,
      depositStatus: byOrder[r.orderId]?.status ?? "—",
      depositTxn: byOrder[r.orderId]?.transactionId ?? null,
      serviceOrderId: byOrder[r.orderId]?.parentOrderId ?? null,
    })),
  });
}
