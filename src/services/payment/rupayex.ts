// RUPAYEX GATEWAY — pay-in fallback, used when Sunpay can't start a checkout.
//
// Rupayex's callback is unsigned and lands on redirect_url (/r/{orderId}), so it
// is only ever a hint: that route re-asks /order-status here before settling.

import type {
  PaymentGateway,
  CreateOrderInput,
  CreateOrderResult,
  VerifyResult,
} from "./gateway";
import type { PaymentState } from "@/lib/types";
import { prisma } from "@/lib/db";

function cfg() {
  return {
    base: (process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api").replace(/\/$/, ""),
    token: process.env.RUPAYEX_API_TOKEN || "",
  };
}

export const rupayexConfigured = () => !!cfg().token;

function mapStatus(raw: unknown): PaymentState {
  const s = String(raw ?? "").toLowerCase();
  if (/success|paid|complete/.test(s)) return "SUCCESS";
  if (/cancel/.test(s)) return "CANCELLED";
  if (/fail|declin|expire|reject/.test(s)) return "FAILED";
  return "PENDING";
}

export class RupayexGateway implements PaymentGateway {
  readonly name = "rupayex";

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const c = cfg();
    if (!c.token) throw new Error("Rupayex is not configured. Set RUPAYEX_API_TOKEN.");

    const res = await fetch(`${c.base}/create-order`, {
      method: "POST",
      headers: { "X-Api-Token": c.token, Accept: "application/json" },
      body: new URLSearchParams({
        user_token: c.token,
        amount: String(input.amount),
        order_id: input.orderId,
        redirect_url: input.returnUrl || `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/r/${input.orderId}`,
        ...(input.customerPhone ? { customer_mobile: input.customerPhone } : {}),
        remark1: input.gameId,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok || !raw?.status || !raw?.payment_url) {
      throw new Error(`Rupayex create failed (${res.status}): ${JSON.stringify(raw).slice(0, 300)}`);
    }
    // Tag it so verifyPayment knows which gateway owns this order.
    return { redirectUrl: raw.payment_url, raw: { gateway: "rupayex", ...raw } };
  }

  // No signed webhook — callbacks go to /r/{orderId}, which calls verifyPayment.
  async handleWebhook(): Promise<VerifyResult> {
    throw new Error("Rupayex has no webhook endpoint");
  }

  async verifyPayment(orderId: string): Promise<VerifyResult> {
    const c = cfg();
    const p = await prisma.payment.findUnique({ where: { orderId } });
    const stored: VerifyResult = {
      orderId,
      status: (p?.status as PaymentState) ?? "PENDING",
      transactionId: p?.transactionId ?? undefined,
      amount: p?.amount,
      currency: p?.currency,
    };
    if (!p || !c.token) return stored;

    try {
      const url = `${c.base}/order-status?user_token=${encodeURIComponent(c.token)}&order_id=${encodeURIComponent(orderId)}`;
      const res = await fetch(url, {
        headers: { "X-Api-Token": c.token, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      const body: any = await res.json();
      if (!res.ok || !body?.status || String(body.order_id) !== orderId) return stored;
      const amount = Number(body.amount);
      return {
        orderId,
        status: mapStatus(body.payment_status),
        transactionId: body.utr || stored.transactionId,
        amount: Number.isFinite(amount) ? amount : stored.amount,
        raw: { gateway: "rupayex", ...body },
      };
    } catch {
      return stored;
    }
  }
}
