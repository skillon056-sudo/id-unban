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
  if (["PENDING", "IN_PROGRESS", "FILED", "CLOSED", "REJECTED"].includes(status)) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { gameId: { contains: search } },
      { orderId: { contains: search } },
      { contactEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.unbanRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Attach payment state so the operator can see what actually cleared.
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: items.map((i) => i.orderId) } },
    select: { orderId: true, status: true, transactionId: true },
  });
  const byOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      paymentStatus: byOrder[i.orderId]?.status ?? (i.amount === 0 ? "FREE" : "—"),
      transactionId: byOrder[i.orderId]?.transactionId ?? null,
    })),
  });
}
