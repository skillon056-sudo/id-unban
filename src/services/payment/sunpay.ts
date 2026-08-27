// ─────────────────────────────────────────────────────────────────────────
// SUNPAY GATEWAY — pay-in (deposits / money IN) via UPI.
//
// Contract: every request is HMAC-SHA256 signed. A payment is settled ONLY
// from a signature-verified webhook (never from the browser redirect).
// This maps onto the app's single settlement point, settlePayment(), which is
// idempotent + amount-checked + transactional.
//
// Credentials come from env only (see .env.example). Nothing here is imported
// by client components, so secrets never reach the browser.
// ─────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "crypto";
import type {
  PaymentGateway,
  CreateOrderInput,
  CreateOrderResult,
  VerifyResult,
} from "./gateway";
import type { PaymentState } from "@/lib/types";
import { prisma } from "@/lib/db";

function cfg() {
  const base = (process.env.SUNPAY_BASE_URL || "").replace(/\/$/, "");
  return {
    base,
    payinPath: process.env.SUNPAY_PAYIN_PATH || "/api/public/v1/payins",
    apiKey: process.env.SUNPAY_PAYIN_API_KEY || "",
    apiSecret: process.env.SUNPAY_PAYIN_API_SECRET || "",
    webhookSecret: process.env.SUNPAY_WEBHOOK_SECRET || "",
    method: process.env.SUNPAY_METHOD || "upi",
    currency: process.env.SUNPAY_CURRENCY || "INR",
    minAmount: parseInt(process.env.SUNPAY_MIN_AMOUNT || "1", 10),
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  };
}

const hmacHex = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

// Map Sunpay's status string to our lifecycle state.
function mapStatus(raw: unknown): PaymentState {
  const s = String(raw ?? "").toLowerCase();
  if (/success|paid|complete|captur|settle/.test(s)) return "SUCCESS";
  if (/cancel/.test(s)) return "CANCELLED";
  if (/fail|declin|expire|reject/.test(s)) return "FAILED";
  return "PENDING";
}

export class SunpayGateway implements PaymentGateway {
  readonly name = "sunpay";

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const c = cfg();
    if (!c.base || !c.apiKey || !c.apiSecret) {
      throw new Error("Sunpay is not configured. Set SUNPAY_BASE_URL / SUNPAY_PAYIN_API_KEY / SUNPAY_PAYIN_API_SECRET.");
    }
    if (input.amount < c.minAmount) {
      throw new Error(`Amount below Sunpay minimum (₹${c.minAmount}).`);
    }

    const body: Record<string, unknown> = {
      order_id: input.orderId, // must be A-Z0-9, no hyphens (see generateOrderId)
      amount: input.amount, // major units (₹)
      currency: c.currency,
      method: c.method,
      notify_url: `${c.baseUrl}/api/payment/webhook`,
      redirect_url: `${c.baseUrl}/appeal/${input.orderId}`,
    };

    // Sign the EXACT bytes we send — serialize once, sign that string, send it.
    const payload = JSON.stringify(body);
    const res = await fetch(`${c.base}${c.payinPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": c.apiKey,
        "x-signature": hmacHex(c.apiSecret, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(15000),
    });

    const raw: any = await res.json().catch(() => ({}));
    const data = raw?.data || raw || {};
    const txn = raw?.transaction || {};
    const checkoutUrl =
      data.checkout_url || data.payment_url || txn.gateway_payment_url || data.url;

    if (!res.ok || !checkoutUrl) {
      throw new Error(`Sunpay create failed (${res.status}): ${JSON.stringify(raw).slice(0, 300)}`);
    }
    return { redirectUrl: checkoutUrl, raw };
  }

  async handleWebhook(req: Request): Promise<VerifyResult> {
    const c = cfg();
    // Verify over the RAW body bytes — never a re-serialized object.
    const rawBody = await req.text();
    const sig = (req.headers.get("x-signature") || req.headers.get("x-webhook-signature") || "").trim();

    if (!this.verify(rawBody, sig, c)) {
      throw new Error("Invalid Sunpay webhook signature");
    }

    const raw: any = JSON.parse(rawBody);
    const data = raw?.data || raw || {};
    const txn = raw?.transaction || {};

    const orderId = raw.order_id || data.order_id || txn.order_id;
    if (!orderId) throw new Error("Webhook missing order_id");

    const amountRaw = data.amount ?? raw.amount ?? txn.amount;
    const amount = amountRaw != null ? Number(amountRaw) : undefined;

    return {
      orderId: String(orderId),
      status: mapStatus(data.status ?? raw.status ?? txn.status),
      transactionId: txn.id || data.txn_id || data.transaction_id || data.reference || undefined,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: data.currency || raw.currency || undefined,
      raw,
    };
  }

  // Timing-safe HMAC check against the pay-in secret, with the webhook secret
  // as a fallback if configured.
  private verify(rawBody: string, signature: string, c: ReturnType<typeof cfg>): boolean {
    if (!signature) return false;
    const given = Buffer.from(signature);
    for (const secret of [c.apiSecret, c.webhookSecret]) {
      if (!secret) continue;
      const expected = Buffer.from(hmacHex(secret, rawBody));
      if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
    }
    return false;
  }

  // No documented status-poll endpoint — the webhook is the source of truth,
  // so reflect the stored state for the pending-page poll.
  async verifyPayment(orderId: string): Promise<VerifyResult> {
    const p = await prisma.payment.findUnique({ where: { orderId } });
    return {
      orderId,
      status: (p?.status as PaymentState) ?? "PENDING",
      transactionId: p?.transactionId ?? undefined,
      amount: p?.amount,
      currency: p?.currency,
    };
  }
}
