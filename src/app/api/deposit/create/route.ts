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
  const { orderId, phone, upiId } = parsed.data;

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
    select: { id: true, contactEmail: true, contactPhone: true, depositSeenAt: true },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  // The page hides the form once the step's countdown ends; enforce it here too
  // so a tab left open can't post afterwards.
  const timerMinutes = Math.max(0, Math.round(Number(settings.deposit_timer_minutes ?? 25)));
  if (timerMinutes > 0 && request.depositSeenAt) {
    const endsAt = request.depositSeenAt.getTime() + timerMinutes * 60 * 1000;
    if (Date.now() >= endsAt) {
      return NextResponse.json(
        { error: "Time for this step has run out. Please contact support." },
        { status: 409 },
      );
    }
  }

  // Always a fresh deposit order. Handing back an open one means handing back
  // its checkout, and the gateway ties a checkout to its order id — by the
  // second attempt that page has expired, so the customer cannot pay on it.
  const depositOrderId = generateOrderId();

  await prisma.payment.create({
    data: {
      orderId: depositOrderId, kind: "DEPOSIT", parentOrderId: orderId,
      gameId: service.gameId, amount, currency, status: "CREATED",
    },
  });

  // Refund record travels with the deposit and holds the payout destination.
  await prisma.refund.create({
    data: {
      orderId: depositOrderId, requestId: request.id, gameId: service.gameId,
      amount, currency, upiId: upiId ?? "", phone: phone ?? null, status: "NOT_REQUESTED",
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
      // Back to the case page for the service order this deposit belongs to.
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/r/${orderId}`,
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
