import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { sendPayout, payoutStatus } from "@/services/payment/payout";
import { upiIdSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const payoutSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("upi"),
    beneficiaryName: z.string().trim().min(2).max(120),
    beneficiaryAccount: upiIdSchema,
  }),
  z.object({
    method: z.literal("bank"),
    beneficiaryName: z.string().trim().min(2).max(120),
    beneficiaryAccount: z.string().trim().regex(/^\d{6,20}$/, "Enter a valid account number."),
    ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Enter a valid IFSC."),
    bankName: z.string().trim().max(120).optional(),
  }),
]);

// POST /api/admin/refunds/:orderId/payout — sends the deposit back through the
// gateway. The amount is never taken from the request: it comes from the refund
// record, so the form can't be used to send an arbitrary sum. payoutId is
// derived from the order, which is also the gateway's idempotency key, so a
// double click or a retry cannot pay twice.
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = payoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the payout details." },
      { status: 400 },
    );
  }

  const refund = await prisma.refund.findUnique({ where: { orderId: params.orderId } });
  if (!refund) return NextResponse.json({ error: "Refund not found." }, { status: 404 });

  // Only send back a deposit that actually cleared.
  const deposit = await prisma.payment.findUnique({
    where: { orderId: params.orderId },
    select: { status: true, kind: true },
  });
  if (!deposit || deposit.kind !== "DEPOSIT" || deposit.status !== "SUCCESS") {
    return NextResponse.json(
      { error: "That deposit never cleared — there is nothing to refund." },
      { status: 409 },
    );
  }
  if (refund.status === "COMPLETED") {
    return NextResponse.json({ error: "This refund is already completed." }, { status: 409 });
  }

  // A payout already exists for this refund: report where it stands rather than
  // sending a second one.
  if (refund.payoutId) {
    const s = await payoutStatus(refund.payoutId);
    return NextResponse.json(
      { error: `A payout was already sent for this refund (gateway says: ${s.status ?? "unknown"}).` },
      { status: 409 },
    );
  }

  const payoutId = `PO${params.orderId}`;

  // Recorded as sent BEFORE the call returns, so a timeout can't leave us
  // without a record of a payout that may have gone through.
  await prisma.refund.update({
    where: { orderId: params.orderId },
    data: {
      payoutId,
      payoutMethod: parsed.data.method,
      payoutAccount: parsed.data.beneficiaryAccount,
      payoutSentAt: new Date(),
      status: "PROCESSING",
    },
  });

  const result = await sendPayout({
    payoutId,
    amount: refund.amount,
    method: parsed.data.method,
    beneficiaryName: parsed.data.beneficiaryName,
    beneficiaryAccount: parsed.data.beneficiaryAccount,
    ifsc: parsed.data.method === "bank" ? parsed.data.ifsc : undefined,
    bankName: parsed.data.method === "bank" ? parsed.data.bankName : undefined,
  });

  if (!result.ok) {
    // Clear the claim only when the gateway explicitly refused, so a retry is
    // possible. A timeout keeps it, because the money may already be moving.
    const refused = /refused|not configured/i.test(result.error ?? "");
    await prisma.refund.update({
      where: { orderId: params.orderId },
      data: refused
        ? { payoutId: null, payoutSentAt: null, status: "PENDING" }
        : { payoutStatus: "unknown", notes: `${refund.notes ?? ""}\nPayout attempt: ${result.error}`.trim() },
    });
    console.error(`[payout] failed order=${params.orderId}: ${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await prisma.refund.update({
    where: { orderId: params.orderId },
    data: { payoutStatus: result.status ?? "pending" },
  });

  console.log(`[payout] sent order=${params.orderId} payout=${payoutId} amount=${refund.amount}`);
  return NextResponse.json({ ok: true, payoutId, status: result.status });
}

// GET — refresh what the gateway says about this refund's payout.
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  const refund = await prisma.refund.findUnique({ where: { orderId: params.orderId } });
  if (!refund?.payoutId) return NextResponse.json({ status: null });

  const s = await payoutStatus(refund.payoutId);
  if (!s.ok) return NextResponse.json({ status: refund.payoutStatus, error: s.error });

  const raw: any = s.raw ?? {};
  const done = /success|complete|paid|settle/i.test(s.status ?? "");
  const failed = /fail|reject|declin|cancel/i.test(s.status ?? "");

  const updated = await prisma.refund.update({
    where: { orderId: params.orderId },
    data: {
      payoutStatus: s.status,
      reference: raw.utr || refund.reference,
      status: done ? "COMPLETED" : failed ? "FAILED" : refund.status,
      refundedAt: done && !refund.refundedAt ? new Date() : refund.refundedAt,
    },
  });
  return NextResponse.json({ status: updated.payoutStatus, refundStatus: updated.status, reference: updated.reference });
}
