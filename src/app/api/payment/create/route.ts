import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPaymentSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getDefaults } from "@/lib/defaults";
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
  const defaults = await getDefaults();
  const currency = defaults.currency;

  if (record && (record.status !== "BANNED" || !record.unbanEnabled)) {
    return NextResponse.json(
      { error: "This ID is not eligible for an unban request." },
      { status: 409 },
    );
  }

  // No custom record → default flow. Amount is the server-configured price;
  // the client never supplies or influences it.
  if (!record) {
    return createGatewayOrder(gameId, defaults.priceInr, currency);
  }

  // Free unban: verify OTP, skip the gateway, settle instantly, go to success.
  if (record.freeUnban) {
    const otp = (parsed.data.otp || "").trim();
    if (record.otp && record.otp.length > 0) {
      // Admin fixed a specific OTP — it must match exactly.
      if (otp !== record.otp) {
        return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
      }
    } else if (!otp) {
      // No fixed OTP — any non-empty OTP is accepted.
      return NextResponse.json({ error: "Please enter the OTP to continue." }, { status: 400 });
    }

    // Show the same price the site displayed (so success looks complete),
    // even though no money is collected for a free unban.
    const displayAmount = record.price && record.price > 0 ? record.price : defaults.priceInr;
    const orderId = generateOrderId();
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: { orderId, gameId, amount: displayAmount, currency, status: "SUCCESS", transactionId: "FREE" },
      });
      await tx.unbanRequest.create({
        data: { orderId, gameId, amount: displayAmount, currency, status: "SUBMITTED" },
      });
      await tx.freeFireId.updateMany({
        where: { gameId, status: "BANNED" },
        data: { status: "PENDING" },
      });
    });
    return NextResponse.json({
      orderId,
      free: true,
      redirectUrl: `/payment/success?orderId=${orderId}`,
    });
  }

  // Per-ID price wins; fall back to the global unban_price when not set.
  const amount = record.price && record.price > 0 ? record.price : defaults.priceInr;
  return createGatewayOrder(gameId, amount, currency);
}

// Shared: create the order server-side, then hand off to the gateway.
// Reuses an open order for the same ID to avoid duplicate charges.
async function createGatewayOrder(gameId: string, amount: number, currency: string) {
  const existing = await prisma.payment.findFirst({
    where: { gameId, status: { in: ["CREATED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });
  const gateway = getGateway();

  if (existing) {
    const { redirectUrl } = await gateway.createOrder({
      orderId: existing.orderId,
      gameId,
      amount: existing.amount,
      currency: existing.currency,
    });
    return NextResponse.json({ orderId: existing.orderId, redirectUrl });
  }

  const orderId = generateOrderId();
  await prisma.$transaction([
    prisma.payment.create({ data: { orderId, gameId, amount, currency, status: "CREATED" } }),
    prisma.unbanRequest.create({ data: { orderId, gameId, amount, currency, status: "PENDING" } }),
  ]);

  try {
    const { redirectUrl, raw } = await gateway.createOrder({ orderId, gameId, amount, currency });
    await prisma.payment.update({
      where: { orderId },
      data: { status: "PENDING", gatewayResponse: raw ? JSON.stringify(raw).slice(0, 4000) : undefined },
    });
    return NextResponse.json({ orderId, redirectUrl });
  } catch {
    await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Could not start payment. Please try again later." },
      { status: 502 },
    );
  }
}
