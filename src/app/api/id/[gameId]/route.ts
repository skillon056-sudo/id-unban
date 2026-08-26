import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gameIdSchema } from "@/lib/validation";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getDefaults } from "@/lib/defaults";
import { fetchLiveBanStatus } from "@/services/bancheck";
import type { PublicIdResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Priority: admin record  >  live ban check  >  default configuration.
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
  const gameId = parsed.data;

  const [record, settings, defaults] = await Promise.all([
    prisma.freeFireId.findUnique({
      where: { gameId },
      select: {
        gameId: true, status: true, banReason: true, banDuration: true,
        unbanEnabled: true, unbanLeft: true,
      },
    }),
    getSettings(),
    getDefaults(),
  ]);

  const note = settings.result_note || "";

  // 1. Admin record wins — it's the operator's own curated data.
  if (record) {
    return NextResponse.json<PublicIdResult>({
      gameId: record.gameId,
      status: record.status as PublicIdResult["status"],
      source: "admin",
      banReason: record.status === "BANNED" ? record.banReason || defaults.category : null,
      banDuration: record.status === "BANNED" ? record.banDuration : null,
      requestEnabled: record.status === "BANNED" && record.unbanEnabled,
      unbanLeft: record.unbanLeft,
      note,
    });
  }

  // 2. Live check (unofficial proxy of Garena's public anti-hack check).
  const live = await fetchLiveBanStatus(gameId);
  if (live) {
    return NextResponse.json<PublicIdResult>({
      gameId,
      status: live.banned ? "BANNED" : "UNBANNED",
      source: "live",
      banReason: live.banned ? defaults.category : null,
      banDuration: live.periodMonths ? `${live.periodMonths} months` : null,
      requestEnabled: live.banned,
      unbanLeft: null,
      note,
    });
  }

  // 3. Nothing available — say so plainly rather than inventing a status.
  return NextResponse.json<PublicIdResult>({
    gameId,
    status: "INFORMATION UNAVAILABLE",
    source: "unavailable",
    banReason: null,
    banDuration: null,
    requestEnabled: false,
    unbanLeft: null,
    note,
  });
}
