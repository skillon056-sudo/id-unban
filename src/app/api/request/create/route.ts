import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPaymentSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { generateOrderId } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Free appeal request — no payment, no gateway. Records the request and
// hands back a reference the user can keep.
export async function POST(req: Request) {
  const rl = checkRate(`req:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid Free Fire ID." }, { status: 400 });
  }
  const { gameId } = parsed.data;

  // Reuse an open request for the same ID instead of stacking duplicates.
  const existing = await prisma.unbanRequest.findFirst({
    where: { gameId, status: "SUBMITTED" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({
      orderId: existing.orderId,
      redirectUrl: `/request/submitted?ref=${existing.orderId}`,
    });
  }

  const orderId = generateOrderId();
  await prisma.unbanRequest.create({
    data: { orderId, gameId, amount: 0, currency: "INR", status: "SUBMITTED" },
  });

  return NextResponse.json({
    orderId,
    redirectUrl: `/request/submitted?ref=${orderId}`,
  });
}
