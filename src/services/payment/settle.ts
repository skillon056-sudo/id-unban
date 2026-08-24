// Server-side settlement — the single source of truth for moving a payment
// to its final state. Called from the webhook route (and the pending-page
// verify poll). Idempotent: a repeated SUCCESS webhook does nothing the
// second time.

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

  // Idempotency: never re-process an already-final payment.
  if (payment.status === "SUCCESS" || payment.status === "FAILED" || payment.status === "CANCELLED") {
    return { ok: true, status: payment.status, reason: "already settled" };
  }

  // Amount/currency tamper check on success.
  if (v.status === "SUCCESS") {
    if (typeof v.amount === "number" && v.amount !== payment.amount) {
      await mark(payment.orderId, "FAILED", v);
      return { ok: false, status: "FAILED", reason: "amount mismatch" };
    }
    if (v.currency && v.currency !== payment.currency) {
      await mark(payment.orderId, "FAILED", v);
      return { ok: false, status: "FAILED", reason: "currency mismatch" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId: v.orderId },
      data: {
        status: v.status,
        transactionId: v.transactionId ?? payment.transactionId,
        gatewayResponse: v.raw ? JSON.stringify(v.raw).slice(0, 4000) : payment.gatewayResponse,
      },
    });

    if (v.status === "SUCCESS") {
      // Advance the unban request; move the ID into review (PENDING).
      await tx.unbanRequest.updateMany({
        where: { orderId: v.orderId },
        data: { status: "SUBMITTED" },
      });
      await tx.freeFireId.updateMany({
        where: { gameId: payment.gameId, status: "BANNED" },
        data: { status: "PENDING" },
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

async function mark(orderId: string, status: string, v: VerifyResult) {
  await prisma.payment.update({
    where: { orderId },
    data: {
      status,
      gatewayResponse: v.raw ? JSON.stringify(v.raw).slice(0, 4000) : undefined,
    },
  });
  await prisma.unbanRequest.updateMany({ where: { orderId }, data: { status: "REJECTED" } });
}
