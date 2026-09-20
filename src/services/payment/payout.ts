// ─────────────────────────────────────────────────────────────────────────
// Gateway payouts — money OUT, used to return security deposits.
//
// Separate credentials from pay-ins (the gateway issues two key pairs; mixing
// them fails with invalid_api_key). Every request is HMAC-SHA256 signed over
// the exact bytes sent; reads are signed over an empty body.
//
// Nothing here decides who gets paid — the caller passes an amount read from
// our own record, and payout_id is our idempotency key, so a retry can never
// send twice.
// ─────────────────────────────────────────────────────────────────────────

import { createHmac } from "crypto";

function cfg() {
  return {
    base: (process.env.SUNPAY_BASE_URL || "").replace(/\/$/, ""),
    key: process.env.SUNPAY_PAYOUT_API_KEY || "",
    secret: process.env.SUNPAY_PAYOUT_API_SECRET || "",
    currency: process.env.SUNPAY_CURRENCY || "INR",
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "",
  };
}

const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

export const payoutsConfigured = () => {
  const c = cfg();
  return Boolean(c.base && c.key && c.secret);
};

export interface PayoutInput {
  payoutId: string;
  amount: number;
  method: "upi" | "bank";
  beneficiaryName: string;
  beneficiaryAccount: string; // VPA for upi, account number for bank
  ifsc?: string;
  bankName?: string;
}

export interface PayoutResult {
  ok: boolean;
  status?: string;
  error?: string;
  raw?: unknown;
}

export async function sendPayout(input: PayoutInput): Promise<PayoutResult> {
  const c = cfg();
  if (!payoutsConfigured()) {
    return { ok: false, error: "Payouts are not configured. Add the payout API key and secret." };
  }

  const body: Record<string, unknown> = {
    payout_id: input.payoutId,
    amount: input.amount,
    currency: c.currency,
    method: input.method,
    beneficiary_name: input.beneficiaryName,
    beneficiary_account: input.beneficiaryAccount,
    ...(input.ifsc ? { ifsc: input.ifsc } : {}),
    ...(input.bankName ? { bank_name: input.bankName } : {}),
    ...(c.baseUrl ? { notify_url: `${c.baseUrl}/api/payment/webhook` } : {}),
  };

  const payload = JSON.stringify(body);
  try {
    const res = await fetch(`${c.base}/api/public/v1/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": c.key,
        "x-signature": sign(c.secret, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(20000),
    });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: raw?.message || `Gateway refused (${res.status}).`, raw };
    }
    return { ok: true, status: String(raw?.status ?? "pending"), raw };
  } catch (err) {
    // Unknown outcome: the request may have gone through. The caller records it
    // as sent and the status check settles it, rather than risking a re-send.
    return { ok: false, error: err instanceof Error ? err.message : "Gateway unreachable." };
  }
}

export async function payoutStatus(payoutId: string): Promise<PayoutResult> {
  const c = cfg();
  if (!payoutsConfigured()) return { ok: false, error: "Payouts are not configured." };
  try {
    const res = await fetch(
      `${c.base}/api/public/v1/payouts/status/${encodeURIComponent(payoutId)}`,
      { headers: { "x-api-key": c.key, "x-signature": sign(c.secret, "") }, signal: AbortSignal.timeout(15000) },
    );
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: raw?.message || `Gateway refused (${res.status}).`, raw };
    return { ok: true, status: String(raw?.status ?? ""), raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gateway unreachable." };
  }
}

export async function merchantBalance(): Promise<PayoutResult & { balance?: number }> {
  const c = cfg();
  if (!payoutsConfigured()) return { ok: false, error: "Payouts are not configured." };
  try {
    const res = await fetch(`${c.base}/api/public/v1/balance?currency=${encodeURIComponent(c.currency)}`, {
      headers: { "x-api-key": c.key, "x-signature": sign(c.secret, "") },
      signal: AbortSignal.timeout(15000),
    });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: raw?.message || `Gateway refused (${res.status}).`, raw };
    return { ok: true, balance: Number(raw?.balance ?? 0), raw };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gateway unreachable." };
  }
}
