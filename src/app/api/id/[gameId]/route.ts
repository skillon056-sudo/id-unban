import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gameIdSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
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
    select: { gameId: true, status: true, banReason: true, unbanEnabled: true, price: true },
  });

  if (!record) {
    // Generic message — don't confirm/deny internal details.
    return NextResponse.json({ error: "ID not found. Please check the ID and try again." }, { status: 404 });
  }

  const settings = await getSettings();
  const price = record.price && record.price > 0 ? record.price : parseInt(settings.unban_price || "199", 10);

  const result: PublicIdResult = {
    gameId: record.gameId,
    status: record.status as PublicIdResult["status"],
    // Only surface a ban reason for banned accounts.
    banReason: record.status === "BANNED" ? record.banReason : null,
    unbanEnabled: record.status === "BANNED" && record.unbanEnabled,
    price,
    currency: settings.currency || "INR",
  };
  return NextResponse.json(result);
}
