import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/payments?status=&search=
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.toUpperCase() || "ALL";
  const search = url.searchParams.get("search")?.trim() || "";

  const where: Prisma.PaymentWhereInput = {};
  if (["CREATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED"].includes(status)) where.status = status;
  if (search) {
    where.OR = [
      { orderId: { contains: search } },
      { gameId: { contains: search } },
      { transactionId: { contains: search } },
    ];
  }

  const items = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderId: true,
      gameId: true,
      amount: true,
      currency: true,
      status: true,
      transactionId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items });
}
