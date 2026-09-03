import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { depositIntakeSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";

export const dynamic = "force-dynamic";

// Starts the security-deposit payment. Only reachable for an order whose
// SERVICE payment the server has already verified as SUCCESS — a browser can't
// talk its way in. The amount comes from settings, never from the request.
export async function POST(req: Request) {
  const rl = checkRate(`deposit:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = depositIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Please check the form." },
      { status: 400 },
    );
  }
  const { orderId, upiId } = parsed.data;

  // Gate: the original service payment must be verified.
  const service = await prisma.payment.findUnique({
    where: { orderId },
    select: { status: true, gameId: true, kind: true },
  });
  if (!service || service.kind !== "SERVICE" || service.status !== "SUCCESS") {
    return NextResponse.json(
      { error: "This step isn't available for that order." },
      { status: 403 },
    );
  }

  const settings = await getSettings();
  const amount = Math.round(Number(settings.deposit_amount || 2000));
  const currency = settings.currency || "INR";
  if (!(amount > 0)) {
    return NextResponse.json({ error: "Deposit is not available right now." }, { status: 503 });
  }

  const request = await prisma.unbanRequest.findUnique({
    where: { orderId },
    select: { id: true, contactEmail: true, contactPhone: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  // Reuse an open deposit for this service order rather than stacking orders.
  const open = await prisma.payment.findFirst({
    where: { parentOrderId: orderId, kind: "DEPOSIT", status: { in: ["CREATED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });
  const depositOrderId = open?.orderId ?? generateOrderId();

  if (!open) {
    await prisma.payment.create({
      data: {
        orderId: depositOrderId, kind: "DEPOSIT", parentOrderId: orderId,
        gameId: service.gameId, amount, currency, status: "CREATED",
      },
    });
  }

  // Refund record travels with the deposit and holds the payout destination.
  await prisma.refund.upsert({
    where: { orderId: depositOrderId },
    update: { upiId, amount, currency },
    create: {
      orderId: depositOrderId, requestId: request.id, gameId: service.gameId,
      amount, currency, upiId, status: "NOT_REQUESTED",
    },
  });

  try {
    const { redirectUrl, raw } = await getGateway().createOrder({
      orderId: depositOrderId,
      gameId: service.gameId,
      amount,
      currency,
      customerEmail: request.contactEmail,
      customerPhone: request.contactPhone,
    });
    await prisma.payment.update({
      where: { orderId: depositOrderId },
      data: {
        status: "PENDING",
        gatewayResponse: raw ? JSON.stringify(raw).slice(0, 4000) : undefined,
      },
    });
    console.log(`[deposit] created order=${depositOrderId} parent=${orderId} amount=${amount}`);
    return NextResponse.json({ orderId: depositOrderId, redirectUrl });
  } catch (err) {
    console.error("[deposit] gateway failed:", err instanceof Error ? err.message : err);
    await prisma.payment.update({ where: { orderId: depositOrderId }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Could not start payment. Please try again shortly." },
      { status: 502 },
    );
  }
}
