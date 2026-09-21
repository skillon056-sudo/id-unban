import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appealIntakeSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { generateOrderId } from "@/lib/utils";
import { getGateway } from "@/services/payment";
import { readCookie } from "@/lib/cookies";

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

  // The browser is here now and won't be later: the gateway has no way to send
  // the payer back, so the conversion is reported from the webhook long after
  // this tab is gone. Keep the ad-click identifiers so that event can still be
  // tied to the ad that produced it.
  const sent = body as { fbclid?: string; campaign?: Record<string, string> };
  const attribution = JSON.stringify({
    fbc: fbc(req, sent?.fbclid),
    // Which ad the visit came from, so paying customers can be traced back to
    // the ad set that produced them — the click id alone doesn't say.
    campaign: cleanCampaign(sent?.campaign),
    fbp: readCookie(req, "_fbp"),
    ip: clientIp(req),
    ua: req.headers.get("user-agent"),
  });

  const settings = await getSettings();

  // Already paid once with this email? Don't sell them the same thing twice —
  // send them back to whatever step they actually left unfinished.
  if (settings.service_free !== "true") {
    const resume = await resumeFor(contactEmail, settings.deposit_enabled === "true");
    if (resume) return NextResponse.json(resume);
  }

  const isFree = settings.service_free === "true";
  const fee = isFree ? 0 : Math.round(Number(settings.service_fee || 0));
  const currency = settings.currency || "INR";

  if (!isFree && fee <= 0) {
    return NextResponse.json({ error: "This service is not available right now." }, { status: 503 });
  }

  // Always a fresh order. An unpaid one is never handed back: the gateway ties
  // a checkout to its order id and returns the original — expired by then — so
  // a second attempt would open a dead payment page.
  const orderId = generateOrderId();
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
    await prisma.unbanRequest.create({
      data: { ...caseData, orderId, gameId, status: "IN_PROGRESS" },
    });
    return NextResponse.json({ orderId, redirectUrl: `/appeal/${orderId}` });
  }

  // ── 2. Gateway call runs alongside the writes ───────────────────────
  // Sunpay only needs orderId/amount/currency, all known already — so there's
  // no reason to make it wait behind the database.
  const gatewayCall = getGateway()
    .createOrder({
      orderId,
      gameId,
      amount: fee,
      currency,
      customerEmail: contactEmail,
      customerPhone: contactPhone || null,
      // /r/… is the return path: no query string, because the gateway stops
      // redirecting when one is present.
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/r/${orderId}`,
    })
    .then((r) => ({ ok: true as const, ...r }))
    .catch((err) => ({ ok: false as const, err }));

  const writes = prisma.$transaction([
    prisma.unbanRequest.create({
      data: { ...caseData, orderId, gameId, status: "PENDING" },
    }),
    // Optimistically PENDING: if the gateway call fails we correct it below.
    prisma.payment.create({
      data: { orderId, gameId, amount: fee, currency, status: "PENDING" },
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

/**
 * Where a returning customer belongs. Settlement moves a paid case out of
 * PENDING, so those states are what "they already paid" looks like — but the
 * payment row is still checked, because a free case reaches them too and has no
 * payment behind it.
 *
 * Returns null for anyone who hasn't paid, who then goes through checkout
 * normally.
 */
async function resumeFor(contactEmail: string, depositEnabled: boolean) {
  const cases = await prisma.unbanRequest.findMany({
    where: { contactEmail, status: { in: ["IN_PROGRESS", "FILED", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
    select: { orderId: true },
    take: 10,
  });
  if (cases.length === 0) return null;

  const paid = await prisma.payment.findFirst({
    where: {
      orderId: { in: cases.map((c) => c.orderId) },
      kind: "SERVICE",
      status: "SUCCESS",
      amount: { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: { orderId: true },
  });
  if (!paid) return null;

  if (depositEnabled) {
    const depositDone = await prisma.payment.findFirst({
      where: { parentOrderId: paid.orderId, kind: "DEPOSIT", status: "SUCCESS" },
      select: { orderId: true },
    });
    if (!depositDone) {
      return {
        orderId: paid.orderId,
        redirectUrl: `/refundable-deposit?order=${encodeURIComponent(paid.orderId)}`,
        resumed: true,
      };
    }
  }
  return {
    orderId: paid.orderId,
    redirectUrl: `/appeal/${encodeURIComponent(paid.orderId)}`,
    resumed: true,
  };
}

// Only the known utm fields, trimmed — this comes from the browser.
function cleanCampaign(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const allow = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];
  const out: Record<string, string> = {};
  for (const k of allow) {
    const v = (input as Record<string, unknown>)[k];
    if (typeof v === "string" && v) out[k] = v.slice(0, 120);
  }
  return Object.keys(out).length ? out : undefined;
}
