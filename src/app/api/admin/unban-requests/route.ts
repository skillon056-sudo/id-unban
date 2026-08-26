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

  const items = requests;

  return NextResponse.json({ items });
}
