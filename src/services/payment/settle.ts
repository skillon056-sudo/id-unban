// Server-side settlement — the single source of truth for a payment's final
// state. Called from the webhook (and the status-poll fallback). Idempotent:
// a repeated SUCCESS webhook does nothing the second time.

import { prisma } from "@/lib/db";
import type { VerifyResult } from "./gateway";

export interface SettleOutcome {
  ok: boolean;
  status: string;
  reason?: string;
}

export async function settlePayment(v: VerifyResult): Promise<SettleOutcome> {
  const payment = await prisma.payment.findUnique({ where: { orderId: v.orderId } });
  if (!payment) return { ok: false, status: "FAILED", reason: "unknown order" };

  // Never re-process an already-final payment.
  if (["SUCCESS", "FAILED", "CANCELLED"].includes(payment.status)) {
    return { ok: true, status: payment.status, reason: "already settled" };
  }

  // Tamper checks before accepting a success.
  if (v.status === "SUCCESS") {
    if (typeof v.amount === "number" && v.amount !== payment.amount) {
      await fail(payment.orderId, v, "amount mismatch");
      return { ok: false, status: "FAILED", reason: "amount mismatch" };
    }
    if (v.currency && v.currency !== payment.currency) {
      await fail(payment.orderId, v, "currency mismatch");
      return { ok: false, status: "FAILED", reason: "currency mismatch" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId: v.orderId },
      data: {
        status: v.status,
        transactionId: v.transactionId ?? payment.transactionId,
        gatewayResponse: v.raw
          ? JSON.stringify(v.raw).slice(0, 4000)
          : payment.gatewayResponse,
      },
    });

    if (v.status === "SUCCESS") {
      // Paid — the assistance case moves into our work queue.
      await tx.unbanRequest.updateMany({
        where: { orderId: v.orderId },
        data: { status: "IN_PROGRESS" },
      });
    } else if (v.status === "FAILED" || v.status === "CANCELLED") {
      await tx.unbanRequest.updateMany({
        where: { orderId: v.orderId },
        data: { status: "REJECTED" },
      });
    }
  });

  return { ok: true, status: v.status };
}

async function fail(orderId: string, v: VerifyResult, note: string) {
  await prisma.payment.update({
    where: { orderId },
    data: {
      status: "FAILED",
      gatewayResponse: JSON.stringify({ note, raw: v.raw }).slice(0, 4000),
    },
  });
  await prisma.unbanRequest.updateMany({ where: { orderId }, data: { status: "REJECTED" } });
}
