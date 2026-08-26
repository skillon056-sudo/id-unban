import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appealIntakeSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";

export const dynamic = "force-dynamic";

// Opens a paid appeal-assistance case: records what the customer told us,
// then creates the payment order server-side and returns the checkout URL.
// When the operator has set the service to free, payment is skipped entirely.
export async function POST(req: Request) {
  const rl = checkRate(`appeal:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = appealIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Please check the form and try again." },
      { status: 400 },
    );
  }
  const { gameId, contactEmail, contactPhone, details } = parsed.data;

  const settings = await getSettings();
  const isFree = settings.service_free === "true";
  const fee = isFree ? 0 : Math.round(Number(settings.service_fee || 0));
  const currency = settings.currency || "INR";

  if (!isFree && fee <= 0) {
    return NextResponse.json({ error: "This service is not available right now." }, { status: 503 });
  }

  // Reuse an unpaid case for the same ID rather than stacking duplicates.
  const open = await prisma.unbanRequest.findFirst({
    where: { gameId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const orderId = open?.orderId ?? generateOrderId();

  if (open) {
    await prisma.unbanRequest.update({
      where: { orderId },
      // Re-price too: the operator may have switched free/paid since.
      data: {
        amount: fee, currency,
        contactEmail, contactPhone: contactPhone || null, details: details || null,
      },
    });
  } else {
    await prisma.unbanRequest.create({
      data: {
        orderId, gameId, amount: fee, currency,
        contactEmail, contactPhone: contactPhone || null, details: details || null,
        status: "PENDING",
      },
    });
  }

  // Free mode — no gateway, the case opens immediately.
  if (isFree) {
    await prisma.unbanRequest.update({ where: { orderId }, data: { status: "IN_PROGRESS" } });
    return NextResponse.json({ orderId, redirectUrl: `/appeal/${orderId}` });
  }

  // Paid — order first, then the gateway session.
  await prisma.payment.upsert({
    where: { orderId },
    update: { amount: fee, currency },
    create: { orderId, gameId, amount: fee, currency, status: "CREATED" },
  });

  try {
    const { redirectUrl, raw } = await getGateway().createOrder({
      orderId, gameId, amount: fee, currency,
    });
    await prisma.payment.update({
      where: { orderId },
      data: {
        status: "PENDING",
        gatewayResponse: raw ? JSON.stringify(raw).slice(0, 4000) : undefined,
      },
    });
    return NextResponse.json({ orderId, redirectUrl });
  } catch (err) {
    // Surface the gateway's reason in the server log — the customer gets a
    // generic message, the operator gets something actionable.
    console.error("[sunpay] createOrder failed:", err instanceof Error ? err.message : err);
    await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Could not start payment. Please try again shortly." },
      { status: 502 },
    );
  }
}
