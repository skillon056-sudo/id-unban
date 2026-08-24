// Mock gateway for local development and demos.
// Simulates a hosted checkout page (/payment/mock) where you can click
// "Pay" or "Cancel". It exercises the exact same server-side webhook +
// verification path the real gateway will use, so the app logic is real even
// though the money movement is fake.

import type {
  PaymentGateway,
  CreateOrderInput,
  CreateOrderResult,
  VerifyResult,
} from "./gateway";
import type { PaymentState } from "@/lib/types";
import { prisma } from "@/lib/db";

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const url = new URL("/payment/mock", baseUrl());
    url.searchParams.set("orderId", input.orderId);
    return { redirectUrl: url.toString(), raw: { mock: true } };
  }

  async handleWebhook(req: Request): Promise<VerifyResult> {
    // Mock "signature": in dev we accept a shared token so the flow mirrors
    // real signature verification without real crypto.
    const body = (await req.json()) as {
      orderId?: string;
      outcome?: "success" | "failed" | "cancelled";
    };
    if (!body.orderId) throw new Error("missing orderId");

    const map: Record<string, PaymentState> = {
      success: "SUCCESS",
      failed: "FAILED",
      cancelled: "CANCELLED",
    };
    const status = map[body.outcome ?? "success"] ?? "FAILED";

    return {
      orderId: body.orderId,
      status,
      transactionId: status === "SUCCESS" ? `MOCK-${Date.now()}` : undefined,
      raw: body,
    };
  }

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
