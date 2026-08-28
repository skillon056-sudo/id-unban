// Free Fire player profile lookup (level, region, guild, likes…).
//
// Endpoint-agnostic: PLAYERINFO_API_URL is a template containing {uid},
// e.g. "https://your-host.vercel.app/info?uid={uid}". These community APIs are
// unofficial and go offline often, so every failure falls back to null and the
// result card simply omits the extra fields.

export interface PlayerInfo {
  nickname: string | null;
  level: number | null;
  region: string | null;
  likes: number | null;
  brRank: number | null;
  brPoints: number | null;
  guild: string | null;
  createdAt: string | null; // ISO date
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function fetchPlayerInfo(uid: string): Promise<PlayerInfo | null> {
  const tpl = process.env.PLAYERINFO_API_URL;
  if (!tpl || !tpl.includes("{uid}")) return null; // not configured

  try {
    const res = await fetch(tpl.replace("{uid}", encodeURIComponent(uid)), {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        // Providers that authenticate by header (e.g. freefirecommunity).
        ...(process.env.PLAYERINFO_API_KEY
          ? { "x-api-key": process.env.PLAYERINFO_API_KEY }
          : {}),
      },
    });
    if (!res.ok) return null;

    const body: any = await res.json();
    // Different forks nest it differently; accept the common shapes.
    const b = body?.basicInfo ?? body?.data?.basicInfo ?? body?.AccountInfo ?? null;
    if (!b) return null;

    const clan = body?.clanBasicInfo ?? body?.data?.clanBasicInfo ?? null;
    const created = num(b.createAt);

    const info: PlayerInfo = {
      nickname: typeof b.nickname === "string" && b.nickname ? b.nickname : null,
      level: num(b.level),
      region: typeof b.region === "string" && b.region ? b.region : null,
      likes: num(b.liked),
      brRank: num(b.rank),
      brPoints: num(b.rankingPoints),
      guild: typeof clan?.clanName === "string" && clan.clanName ? clan.clanName : null,
      // createAt is a unix seconds string.
      createdAt: created ? new Date(created * 1000).toISOString() : null,
    };

    // Nothing usable came back — treat as a miss.
    return info.nickname || info.level ? info : null;
  } catch {
    return null;
  }
}
