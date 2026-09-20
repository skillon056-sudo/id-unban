import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Restarts the deposit step's countdown for one order, so a customer who let it
// run out can carry on without asking support. Same gate as the deposit page:
// the service payment must be verified and the deposit must still be owed.
export async function POST(req: Request) {
  const rl = checkRate(`reopen:${clientIp(req)}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const orderId = (body.orderId ?? "").trim();
  if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });

  const [payment, settings] = await Promise.all([
    prisma.payment.findUnique({
      where: { orderId },
      select: { status: true, kind: true },
    }),
    getSettings(),
  ]);

  if (!payment || payment.kind !== "SERVICE" || payment.status !== "SUCCESS") {
    return NextResponse.json({ error: "This step isn't available for that order." }, { status: 403 });
  }
  if (settings.deposit_enabled !== "true") {
    return NextResponse.json({ error: "This step isn't available right now." }, { status: 409 });
  }

  // Already paid — nothing to reopen.
  const done = await prisma.payment.findFirst({
    where: { parentOrderId: orderId, kind: "DEPOSIT", status: "SUCCESS" },
    select: { orderId: true },
  });
  if (done) return NextResponse.json({ error: "This deposit is already paid." }, { status: 409 });

  const updated = await prisma.unbanRequest.updateMany({
    where: { orderId },
    data: { depositSeenAt: new Date() },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  console.log(`[deposit] step reopened order=${orderId}`);
  return NextResponse.json({ ok: true });
}
