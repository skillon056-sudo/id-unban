// Free Fire ID → in-game username lookup (RapidAPI "ID Game Checker").
//
// This confirms an ID really exists and returns the player's nickname.
// It does NOT report ban status — that comes from admin records only.
//
// Note on the upstream API: it replies `msg: "id_found"` even for IDs that
// don't exist, echoing the ID back as the "username" (or prefixing "NO/").
// Those two shapes are the real "not found" signal.

export interface IdLookup {
  exists: boolean;
  username: string | null;
}

export async function lookupUsername(uid: string): Promise<IdLookup | null> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_IDCHECK_HOST || "id-game-checker.p.rapidapi.com";
  if (!key) return null; // not configured → caller skips the username step

  try {
    const res = await fetch(`https://${host}/ff-global/${encodeURIComponent(uid)}`, {
      headers: { "x-rapidapi-host": host, "x-rapidapi-key": key },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body: any = await res.json();
    const username: string | undefined = body?.data?.username;
    if (typeof username !== "string" || !username) return { exists: false, username: null };

    // Upstream echoes the ID (or "NO/<id>") when the account isn't real.
    const notFound = username === uid || username.startsWith("NO/");
    return notFound ? { exists: false, username: null } : { exists: true, username };
  } catch {
    return null; // timeout / network / bad JSON → caller falls back
  }
}
