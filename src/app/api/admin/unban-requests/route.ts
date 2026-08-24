import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/unban-requests?status=&search=
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.toUpperCase() || "ALL";
  const search = url.searchParams.get("search")?.trim() || "";

  const where: Prisma.UnbanRequestWhereInput = {};
  if (["PENDING", "SUBMITTED", "REJECTED"].includes(status)) where.status = status;
  if (search) where.OR = [{ gameId: { contains: search } }, { orderId: { contains: search } }];

  const requests = await prisma.unbanRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Join payment status + txn id for the table.
  const orderIds = requests.map((r) => r.orderId);
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
    select: { orderId: true, status: true, transactionId: true },
  });
  const byOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));

  const items = requests.map((r) => ({
    ...r,
    paymentStatus: byOrder[r.orderId]?.status ?? "UNKNOWN",
    transactionId: byOrder[r.orderId]?.transactionId ?? null,
  }));

  return NextResponse.json({ items });
}
