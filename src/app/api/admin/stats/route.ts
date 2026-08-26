import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Auth enforced by middleware for /api/admin/*.
export async function GET() {
  const [total, banned, unbanned, pending, requests] = await Promise.all([
    prisma.freeFireId.count(),
    prisma.freeFireId.count({ where: { status: "BANNED" } }),
    prisma.freeFireId.count({ where: { status: "UNBANNED" } }),
    prisma.freeFireId.count({ where: { status: "PENDING" } }),
    prisma.unbanRequest.count(),
  ]);

  return NextResponse.json({
    totalIds: total,
    bannedIds: banned,
    unbannedIds: unbanned,
    pendingIds: pending,
    totalRequests: requests,
  });
}
