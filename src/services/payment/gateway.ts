// Payment gateway abstraction.
// The frontend and API routes depend ONLY on this interface, so swapping the
// mock gateway for the real Sunpay gateway needs no changes outside
// src/services/payment/*.

import type { PaymentState } from "@/lib/types";

export interface CreateOrderInput {
  orderId: string;
  gameId: string;
  amount: number; // whole units (e.g. 199)
  currency: string;
  // Passed to the gateway so it can send its own payment receipt — for most
  // customers that is the only confirmation they get, since the gateway's
  // checkout has no way to send them back to us.
  customerEmail?: string | null;
  customerPhone?: string | null;
  /** Where the gateway should send the browser after checkout, if it honours it. */
  returnUrl?: string;
}

export interface CreateOrderResult {
  // Where to send the user's browser to pay.
  redirectUrl: string;
  // Optional raw provider payload for the audit trail.
  raw?: unknown;
}

// Normalized result of a webhook or a server-side verification poll.
export interface VerifyResult {
  orderId: string;
  status: PaymentState;
  transactionId?: string;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface PaymentGateway {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  // Parse + authenticate an incoming webhook request (verifies signature).
  handleWebhook(req: Request): Promise<VerifyResult>;
  // Server-to-server poll for the current authoritative status.
  verifyPayment(orderId: string): Promise<VerifyResult>;
}
