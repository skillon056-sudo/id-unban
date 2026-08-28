import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gameIdSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getDefaults } from "@/lib/defaults";
import { lookupUsername } from "@/services/idcheck";
import { fetchLiveBanStatus } from "@/services/bancheck";
import { fetchPlayerInfo } from "@/services/playerinfo";
import type { PublicIdResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Priority: admin record > live ban check > ID exists but no ban data > 404.
// The username lookup is display-only: it echoes the ID back for accounts that
// don't expose a nickname (banned ones often don't), so it must never decide
// whether an account exists.
export async function GET(
  req: Request,
  { params }: { params: { gameId: string } },
) {
  const rl = checkRate(`id:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const parsed = gameIdSchema.safeParse(params.gameId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid Free Fire ID." }, { status: 400 });
  }
  const gameId = parsed.data;

  // All lookups in parallel — the ban check can be slow on a cold start.
  const [record, settings, defaults, id, live, profile] = await Promise.all([
    prisma.freeFireId.findUnique({
      where: { gameId },
      select: {
        gameId: true, status: true, banReason: true, banDuration: true,
        unbanEnabled: true, unbanLeft: true,
      },
    }),
    getSettings(),
    getDefaults(),
    lookupUsername(gameId),
    fetchLiveBanStatus(gameId),
    fetchPlayerInfo(gameId),
  ]);

  const note = settings.result_note || "";
  const ctaLabel = settings.cta_label || "Get Appeal Help";
  // "free" toggle wins; otherwise show the configured fee.
  const fee =
    settings.service_free === "true" ? null : Number(settings.service_fee || 0) || null;
  const username = profile?.nickname ?? id?.username ?? null;

  // 1. Admin record wins — the operator's own curated data.
  if (record) {
    return NextResponse.json<PublicIdResult>({
      gameId: record.gameId,
      username,
      status: record.status as PublicIdResult["status"],
      source: "admin",
      banReason: record.status === "BANNED" ? record.banReason || defaults.category : null,
      banDuration: record.status === "BANNED" ? record.banDuration : null,
      requestEnabled: record.status === "BANNED" && record.unbanEnabled,
      unbanLeft: record.unbanLeft,
      note,
      profile,
      ctaLabel,
      fee,
    });
  }

  // 2. Live ban status. Reaching this means the account is real.
  if (live) {
    return NextResponse.json<PublicIdResult>({
      gameId,
      username,
      status: live.banned ? "BANNED" : "UNBANNED",
      source: "live",
      banReason: live.banned ? defaults.category : null,
      banDuration: live.periodMonths
        ? `${live.periodMonths} month${live.periodMonths === 1 ? "" : "s"}`
        : null,
      requestEnabled: live.banned,
      unbanLeft: null,
      note,
      profile,
      ctaLabel,
      fee,
    });
  }

  // 3. No ban data, but the username lookup confirmed a real account.
  if (id?.exists) {
    return NextResponse.json<PublicIdResult>({
      gameId,
      username,
      status: "INFORMATION UNAVAILABLE",
      source: "unavailable",
      banReason: null,
      banDuration: null,
      requestEnabled: false,
      unbanLeft: null,
      note,
      profile,
      ctaLabel,
      fee,
    });
  }

  // 4. Nothing anywhere — only now say the ID wasn't found.
  return NextResponse.json(
    { error: "This Free Fire ID was not found. Please check the ID and try again." },
    { status: 404 },
  );
}
