import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gameIdSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getDefaults } from "@/lib/defaults";
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
  const defaults = await getDefaults();
  const usdRate = defaults.usdRate;

  // No custom admin record → every valid ID still gets a result, built from
  // the centralized default configuration. Values are clearly labelled as our
  // own assistance data, never as officially verified Garena information.
  if (!record) {
    const result: PublicIdResult = {
      gameId: parsed.data,
      status: "BANNED",
      known: false,
      banReason: defaults.category,
      banDuration: null,
      unbanEnabled: true,
      free: false,
      price: defaults.priceInr,
      priceUsd: defaults.priceUsd,
      currency: defaults.currency,
      unbanLeft: defaults.unbanLeft,
      note: settings.result_note || "",
    };
    return NextResponse.json(result);
  }

  // Admin record overrides the defaults.
  const price = record.price && record.price > 0 ? record.price : defaults.priceInr;

  const result: PublicIdResult = {
    gameId: record.gameId,
    status: record.status as PublicIdResult["status"],
    known: true,
    // Only surface a ban reason for banned accounts.
    banReason: record.status === "BANNED" ? record.banReason || defaults.category : null,
    banDuration: record.status === "BANNED" ? record.banDuration : null,
    unbanEnabled: record.status === "BANNED" && record.unbanEnabled,
    free: record.freeUnban,
    price,
    priceUsd: inrToUsd(price, usdRate),
    currency: settings.currency || "INR",
    unbanLeft: record.unbanLeft ?? defaults.unbanLeft,
    note: settings.result_note || "",
  };
  return NextResponse.json(result);
}
