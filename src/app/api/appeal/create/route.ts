import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appealIntakeSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";
import { readCookie } from "@/lib/cookies";

export const dynamic = "force-dynamic";

// How long an unpaid case may be handed the checkout it already has.
//
// Sunpay ties one checkout to one order_id: re-creating with the same id
// returns {"idempotent": true} and the ORIGINAL transaction. That checkout
// expires after about five minutes, so a window anywhere near it hands the
// customer back a dead payment page — which is exactly what happened to anyone
// who took a minute to get through the in-app-browser hand-off and clicked pay
// again in Chrome.
//
// Must stay well under the gateway's expiry. Reuse only exists to swallow
// double-clicks; a minute is plenty for that.
const REUSE_MS = 60 * 1000;

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

  // The browser is here now and won't be later: the gateway has no way to send
  // the payer back, so the conversion is reported from the webhook long after
  // this tab is gone. Keep the ad-click identifiers so that event can still be
  // tied to the ad that produced it.
  const attribution = JSON.stringify({
    fbc: fbc(req, (body as { fbclid?: string })?.fbclid),
    fbp: readCookie(req, "_fbp"),
    ip: clientIp(req),
    ua: req.headers.get("user-agent"),
  });

  // ── 1. One parallel read ────────────────────────────────────────────
  const [settings, open] = await Promise.all([
    getSettings(),
    // Reuse an unpaid case only for the SAME person retrying within a short
    // window. Keying on gameId alone let two people searching the same Free
    // Fire ID share one order — the second got the first person's checkout
    // link and overwrote their contact email.
    prisma.unbanRequest.findFirst({
      where: {
        gameId,
        contactEmail,
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - REUSE_MS) },
      },
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
    attribution,
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


// Meta's click id. The pixel normally writes it to the _fbc cookie on landing;
// when it hasn't (blocked, or a hand-off out of an in-app browser beat it), the
// raw fbclid from the ad link is enough to build the same value.
function fbc(req: Request, fbclid?: string): string | null {
  const stored = readCookie(req, "_fbc");
  if (stored) return stored;
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : null;
}
