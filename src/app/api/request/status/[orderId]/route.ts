import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const row = await prisma.unbanRequest.findUnique({
    where: { orderId: params.orderId },
    select: { orderId: true, gameId: true, status: true, createdAt: true },
  });
  if (!row) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json(row);
}
