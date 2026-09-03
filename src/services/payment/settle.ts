// Server-side settlement — the single source of truth for a payment's final
// state. Called from the webhook (and the status-poll fallback). Idempotent:
// a repeated SUCCESS webhook does nothing the second time.

import { prisma } from "@/lib/db";
import type { VerifyResult } from "./gateway";
import { reportPurchaseOnce } from "../report-purchase";

export interface SettleOutcome {
  ok: boolean;
  status: string;
  reason?: string;
}

export async function settlePayment(v: VerifyResult): Promise<SettleOutcome> {
  const payment = await prisma.payment.findUnique({ where: { orderId: v.orderId } });
  if (!payment) return { ok: false, status: "FAILED", reason: "unknown order" };

  const isDeposit = payment.kind === "DEPOSIT";

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

    if (isDeposit) {
      // The deposit is held, not spent. Its refund record starts tracking now;
      // the appeal case keeps whatever status it already had.
      if (v.status === "SUCCESS") {
        await tx.refund.updateMany({
          where: { orderId: v.orderId, status: "NOT_REQUESTED" },
          data: { status: "PENDING", requestedAt: new Date() },
        });
      }
      return;
    }

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

  // Report the conversion the moment the money is confirmed — the customer pays
  // inside their UPI app and the gateway has no way to send them back, so
  // waiting for a browser pixel would lose nearly every one.
  //
  // Deliberately not awaited: the gateway retries anything it doesn't get a 200
  // for within 8 seconds, and Meta can take longer than that. A send that fails
  // or is cut short releases its claim, and the 15-minute sweep retries it.
  if (!isDeposit && v.status === "SUCCESS") {
    void reportPurchaseOnce(v.orderId).catch(() => {});
  }

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
