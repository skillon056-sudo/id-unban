import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gameIdSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { inrToUsd } from "@/lib/utils";
import type { PublicIdResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { gameId: string } },
) {
  // Anti-enumeration: cap lookups per IP.
  const rl = checkRate(`id:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const parsed = gameIdSchema.safeParse(params.gameId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Free Fire ID format." }, { status: 400 });
  }

  const record = await prisma.freeFireId.findUnique({
    where: { gameId: parsed.data },
    select: {
      gameId: true, status: true, banReason: true, banDuration: true,
      unbanEnabled: true, freeUnban: true, price: true, unbanLeft: true,
    },
  });

  const settings = await getSettings();
  const globalPrice = parseInt(settings.unban_price || process.env.UNBAN_PRICE_INR || "1000", 10);
  const usdRate = settings.usd_rate || "83";

  // Unknown ID — never fabricate a Garena result. Either show an explicit
  // "information unavailable" card, or (if the admin enabled it) a clearly
  // labelled assistance category.
  if (!record) {
    if (settings.unknown_assist === "true") {
      const reason = settings.unknown_reason || "USED HACK OR OTHER";
      const result: PublicIdResult = {
        gameId: parsed.data,
        status: "INFORMATION UNAVAILABLE",
        known: false,
        banReason: `Assistance category: ${reason}`,
        banDuration: null,
        unbanEnabled: true,
        free: false,
        price: globalPrice,
        priceUsd: inrToUsd(globalPrice, usdRate),
        currency: settings.currency || "INR",
        unbanLeft: null,
      };
      return NextResponse.json(result);
    }
    const result: PublicIdResult = {
      gameId: parsed.data,
      status: "INFORMATION UNAVAILABLE",
      known: false,
      banReason: "Reason information has not been provided for this ID.",
      banDuration: null,
      unbanEnabled: false,
      free: false,
      price: globalPrice,
      priceUsd: inrToUsd(globalPrice, usdRate),
      currency: settings.currency || "INR",
      unbanLeft: null,
    };
    return NextResponse.json(result);
  }

  const price = record.price && record.price > 0 ? record.price : globalPrice;

  const result: PublicIdResult = {
    gameId: record.gameId,
    status: record.status as PublicIdResult["status"],
    known: true,
    // Only surface a ban reason for banned accounts.
    banReason: record.status === "BANNED" ? record.banReason : null,
    banDuration: record.status === "BANNED" ? record.banDuration : null,
    unbanEnabled: record.status === "BANNED" && record.unbanEnabled,
    free: record.freeUnban,
    price,
    priceUsd: inrToUsd(price, usdRate),
    currency: settings.currency || "INR",
    unbanLeft: record.unbanLeft,
  };
  return NextResponse.json(result);
}
