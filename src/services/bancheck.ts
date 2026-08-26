// Live ban-status lookup.
//
// Points at a self-hostable ban-check service (see BANCHECK_API_URL). This is
// NOT an official Garena API — it proxies Garena's public anti-hack check, so
// it can break at any time and is subject to Garena's terms. Everything here
// fails soft: if the lookup errors, times out, or isn't configured, the caller
// falls back to admin/default data.
//
// Timeout is generous: the upstream cold-starts slowly (~17s) then
// responds in 1-2s.
//
// Recommended: self-host the proxy and set BANCHECK_API_URL to your own
// deployment rather than depending on a shared public instance.

export interface LiveBanStatus {
  banned: boolean;
  /** Ban period in months, when the source reports one. */
  periodMonths: number | null;
}

export async function fetchLiveBanStatus(uid: string): Promise<LiveBanStatus | null> {
  const base = (process.env.BANCHECK_API_URL || "").replace(/\/$/, "");
  if (!base) return null; // not configured → caller uses fallback data

  const url = new URL(`${base}/bancheck`);
  url.searchParams.set("uid", uid);
  const key = process.env.BANCHECK_API_KEY;
  if (key) url.searchParams.set("key", key);

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data: any = await res.json();
    if (typeof data?.is_banned !== "boolean") return null;

    const period = Number(data.ban_period);
    return {
      banned: data.is_banned,
      periodMonths: Number.isFinite(period) && period > 0 ? period : null,
    };
  } catch {
    return null; // network error / timeout / bad JSON → fallback
  }
}
