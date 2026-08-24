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

export function generateOrderId(): string {
  // Sunpay requires order_id to be A-Z0-9 with NO hyphens.
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `FF${ts}${rand}`.toUpperCase();
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString();
}
