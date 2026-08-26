import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appealIntakeSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";

export const dynamic = "force-dynamic";

// Opens a paid appeal-assistance case and returns the checkout URL.
//
// Latency matters here — the user is staring at a spinner. Each round trip to
// the database costs hundreds of ms (seconds if the instance is cold), so the
// work is arranged as: one parallel read, then the gateway call running
// alongside the writes, then nothing blocking before the redirect.
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

  // ── 1. One parallel read ────────────────────────────────────────────
  const [settings, open] = await Promise.all([
    getSettings(),
    prisma.unbanRequest.findFirst({
      where: { gameId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { orderId: true },
    }),
  ]);

  const isFree = settings.service_free === "true";
  const fee = isFree ? 0 : Math.round(Number(settings.service_fee || 0));
  const currency = settings.currency || "INR";

  if (!isFree && fee <= 0) {
    return NextResponse.json({ error: "This service is not available right now." }, { status: 503 });
  }

  const orderId = open?.orderId ?? generateOrderId();
  const caseData = {
    contactEmail,
    contactPhone: contactPhone || null,
    details: details || null,
    amount: fee,
    currency,
  };

  // ── Free mode: no gateway, single write, straight to the case page ──
  if (isFree) {
    await prisma.unbanRequest.upsert({
      where: { orderId },
      update: { ...caseData, status: "IN_PROGRESS" },
      create: { ...caseData, orderId, gameId, status: "IN_PROGRESS" },
    });
    return NextResponse.json({ orderId, redirectUrl: `/appeal/${orderId}` });
  }

  // ── 2. Gateway call runs alongside the writes ───────────────────────
  // Sunpay only needs orderId/amount/currency, all known already — so there's
  // no reason to make it wait behind the database.
  const gatewayCall = getGateway()
    .createOrder({ orderId, gameId, amount: fee, currency })
    .then((r) => ({ ok: true as const, ...r }))
    .catch((err) => ({ ok: false as const, err }));

  const writes = prisma.$transaction([
    prisma.unbanRequest.upsert({
      where: { orderId },
      update: caseData,
      create: { ...caseData, orderId, gameId, status: "PENDING" },
    }),
    // Optimistically PENDING: if the gateway call fails we correct it below.
    prisma.payment.upsert({
      where: { orderId },
      update: { amount: fee, currency, status: "PENDING" },
      create: { orderId, gameId, amount: fee, currency, status: "PENDING" },
    }),
  ]);

  const [result] = await Promise.all([gatewayCall, writes]);

  if (!result.ok) {
    console.error("[sunpay] createOrder failed:", result.err instanceof Error ? result.err.message : result.err);
    await prisma.payment.update({ where: { orderId }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Could not start payment. Please try again shortly." },
      { status: 502 },
    );
  }

  // ── 3. Nothing blocking before the redirect ─────────────────────────
  // The raw gateway payload is only for diagnostics, and settle() replaces it
  // with the webhook body anyway — so don't make the user wait for it.
  if (result.raw) {
    prisma.payment
      .update({
        where: { orderId },
        data: { gatewayResponse: JSON.stringify(result.raw).slice(0, 4000) },
      })
      .catch(() => {});
  }

  return NextResponse.json({ orderId, redirectUrl: result.redirectUrl });
}
