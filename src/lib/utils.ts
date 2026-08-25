// Tiny classNames joiner — no dependency needed.
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatMoney(amountMinor: number, currency = "INR"): string {
  // Amounts are stored as whole units (e.g. 199 = ₹199) for simplicity.
  // ponytail: whole-unit money; switch to minor units + a money lib if you
  // ever need sub-unit precision or multi-currency rounding.
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  return `${symbol}${amountMinor} ${symbol ? "" : currency}`.trim();
}

// Convert an INR amount to USD for display. `rate` = INR per 1 USD.
export function inrToUsd(inr: number, rate: string | number): number {
  const r = typeof rate === "string" ? parseFloat(rate) : rate;
  if (!r || r <= 0) return inr;
  return Math.round((inr / r) * 100) / 100;
}

// Convert a USD price to the INR amount the gateway actually charges.
export function usdToInr(usd: number, rate: string | number): number {
  const r = typeof rate === "string" ? parseFloat(rate) : rate;
  return Math.round(usd * (r || 83));
}

export function generateOrderId(): string {
  // Sunpay requires order_id to be A-Z0-9 with NO hyphens.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `FF${ts}${rand}`.toUpperCase();
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString();
}
