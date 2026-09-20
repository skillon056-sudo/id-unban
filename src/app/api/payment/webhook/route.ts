import { NextResponse } from "next/server";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gateway -> our server. The gateway implementation authenticates the request
// (signature verification) inside handleWebhook. A browser success redirect
// never settles anything; only this path does.
//
// Always answers 200 once the signature checks out — a non-2xx makes the
// gateway retry for hours over an outcome we already recorded.
export async function POST(req: Request) {
  const t0 = Date.now();
  const gateway = getGateway();

  let verified;
  try {
    verified = await gateway.handleWebhook(req);
  } catch (err) {
    // Bad signature or unparseable body — the only case worth rejecting.
    console.error(
      `[webhook] rejected provider=${gateway.name}:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  console.log(
    `[webhook] received provider=${gateway.name} order=${verified.orderId} ` +
      `status=${verified.status} amount=${verified.amount ?? "-"} ` +
      `${verified.currency ?? ""} txn=${verified.transactionId ?? "-"}`,
  );

  // Money we sent out: mark the refund, never touch a payment.
  if (verified.payout) {
    const { payoutId, status, utr } = verified.payout;
    // Events seen: payout.reserved -> payout.approved -> payout.updated.
    // Only a settled one closes the refund; the rest are progress.
    const done = /success|complete|paid|settle/i.test(status);
    const failed = /fail|reject|declin|cancel|return/i.test(status);
    const r = await prisma.refund.updateMany({
      where: { payoutId },
      data: {
        payoutStatus: status,
        ...(utr ? { reference: utr } : {}),
        ...(done ? { status: "COMPLETED", refundedAt: new Date() } : {}),
        ...(failed ? { status: "FAILED" } : {}),
      },
    });
    // Payouts sent from the Withdraw page live in their own table.
    const p = await prisma.payout.updateMany({
      where: { payoutId },
      data: {
        gatewayStatus: status,
        ...(utr ? { utr } : {}),
        ...(done ? { status: "COMPLETED", settledAt: new Date() } : {}),
        ...(failed ? { status: "FAILED" } : {}),
      },
    });
    console.log(
      `[webhook] payout=${payoutId} status=${status} refunds=${r.count} payouts=${p.count}`,
    );
    return NextResponse.json({ ok: true, payout: payoutId, matched: r.count + p.count });
  }

  const outcome = await settlePayment(verified);

  // The Sunpay merchant account is shared with another site, whose webhooks
  // reach this endpoint too — signed with the same secret, but for order ids
  // that were never ours. Those are expected; note them and move on.
  //
  // An unmatched id in OUR format is the alarming case: it means a customer
  // paid and we failed to credit them, so log the whole payload to match it up.
  if (!outcome.ok) {
    const looksOurs = /^FF[A-Z0-9]+$/.test(verified.orderId);
    if (looksOurs) {
      console.error(
        `[webhook] UNMATCHED order=${verified.orderId} reason=${outcome.reason} raw=` +
          JSON.stringify(verified.raw),
      );
    } else {
      console.log(`[webhook] ignored foreign order=${verified.orderId} (not ours)`);
    }
  }

  console.log(
    `[webhook] settled order=${verified.orderId} result=${outcome.status} ` +
      `${outcome.reason ? `(${outcome.reason}) ` : ""}in ${Date.now() - t0}ms`,
  );

  return NextResponse.json({ ok: outcome.ok, status: outcome.status });
}

// Some gateways probe the endpoint with GET before enabling it.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "payment-webhook" });
}
