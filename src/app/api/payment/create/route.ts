import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPaymentSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = checkRate(`pay:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many payment requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Free Fire ID." }, { status: 400 });
  }
  const { gameId } = parsed.data;

  const settings = await getSettings();
  if (settings.payment_enabled === "false") {
    return NextResponse.json({ error: "Payments are currently disabled." }, { status: 403 });
  }

  const record = await prisma.freeFireId.findUnique({ where: { gameId } });
  if (!record) {
    return NextResponse.json({ error: "ID not found." }, { status: 404 });
  }
  if (record.status !== "BANNED" || !record.unbanEnabled) {
    return NextResponse.json(
      { error: "This ID is not eligible for an unban request." },
      { status: 409 },
    );
  }

  // Prevent duplicate open orders for the same ID.
  const existing = await prisma.payment.findFirst({
    where: { gameId, status: { in: ["CREATED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const gateway = getGateway();
    // Re-issue a redirect to the existing pending order rather than a new one.
    const { redirectUrl } = await gateway.createOrder({
      orderId: existing.orderId,
      gameId,
      amount: existing.amount,
      currency: existing.currency,
    });
    return NextResponse.json({ orderId: existing.orderId, redirectUrl });
  }

  // Per-ID price wins; fall back to the global unban_price when not set.
  const amount = record.price && record.price > 0 ? record.price : parseInt(settings.unban_price || "199", 10);
  const currency = settings.currency || "INR";
  const orderId = generateOrderId();

  // Create order + request rows first (state = CREATED), then ask the gateway.
  await prisma.$transaction([
    prisma.payment.create({
      data: { orderId, gameId, amount, currency, status: "CREATED" },
    }),
    prisma.unbanRequest.create({
      data: { orderId, gameId, amount, currency, status: "PENDING" },
    }),
  ]);

  const gateway = getGateway();
  try {
    const { redirectUrl, raw } = await gateway.createOrder({ orderId, gameId, amount, currency });
    await prisma.payment.update({
      where: { orderId },
      data: { status: "PENDING", gatewayResponse: raw ? JSON.stringify(raw).slice(0, 4000) : undefined },
    });
    return NextResponse.json({ orderId, redirectUrl });
  } catch (err) {
    await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Could not start payment. Please try again later." },
      { status: 502 },
    );
  }
}
