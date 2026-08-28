// Centralized defaults for IDs that have no custom admin record.
// Change them here (or via env / admin Settings) — nothing else duplicates them.

import { getSettings } from "./settings";
import { usdToInr } from "./utils";

// {fee} is replaced with the configured amount at request time.
export const DEFAULT_FEE_NOTE =
  "{fee} covers preparing your appeal, submitting it to Garena support and " +
  "following up. Garena decides the outcome — we can't unban accounts or " +
  "guarantee a result, and you can appeal yourself for free at Garena support.";

export const DEFAULT_ASSISTANCE_CATEGORY = "USED HACK OR OTHER";
export const DEFAULT_UNBAN_LEFT = 4; // shown as "Unban Left: 4 times"
export const DEFAULT_REQUEST_PRICE_USD = Number(process.env.DEFAULT_REQUEST_PRICE_USD || 10);

export interface ResolvedDefaults {
  category: string;
  unbanLeft: number;
  priceUsd: number;
  priceInr: number; // what the gateway is actually charged in INR
  usdRate: string;
  currency: string;
}

// Admin Settings override env, which overrides the constants above.
export async function getDefaults(): Promise<ResolvedDefaults> {
  const s = await getSettings();
  const usdRate = s.usd_rate || "83";
  const priceUsd = Number(s.default_price_usd || DEFAULT_REQUEST_PRICE_USD);
  return {
    category: s.unknown_reason || DEFAULT_ASSISTANCE_CATEGORY,
    unbanLeft: Number(s.default_unban_left || DEFAULT_UNBAN_LEFT),
    priceUsd,
    priceInr: usdToInr(priceUsd, usdRate),
    usdRate,
    currency: s.currency || "INR",
  };
}
