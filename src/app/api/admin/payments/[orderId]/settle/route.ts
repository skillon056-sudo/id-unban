import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { settlePayment } from "@/services/payment/settle";

export const dynamic = "force-dynamic";

// POST /api/admin/payments/:orderId/settle
//
// Records a payment the gateway never told us about. Its checkout takes the
// money before it knows the order is paid — the customer transfers to a UPI
// handle, then has to come back and paste the reference within a few minutes.
// Miss that and the money has moved while the order sits PENDING forever, with
// no way to open the case or the refund.
//
// This is an operator assertion, not a verification: only use it once the
// payment is confirmed in the gateway dashboard or bank statement. It goes
// through the same settlement as a webhook, so everything downstream — case
// status, the refund record for a deposit, the conversion report for a service
// payment — happens exactly as it normally would.
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: { reference?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reference = (body.reference ?? "").trim();
  // The UTR is the whole audit trail for a payment nothing else can prove.
  if (reference.length < 6 || reference.length > 40) {
    return NextResponse.json(
      { error: "Enter the UTR / reference number from the gateway (6–40 characters)." },
      { status: 400 },
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { orderId: params.orderId },
    select: { status: true, amount: true, currency: true },
  });
  if (!payment) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (payment.status === "SUCCESS") {
    return NextResponse.json({ error: "That order is already marked paid." }, { status: 409 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json(
      { error: `That order is ${payment.status} — it can't be marked paid.` },
      { status: 409 },
    );
  }

  const outcome = await settlePayment({
    orderId: params.orderId,
    status: "SUCCESS",
    transactionId: reference,
    amount: payment.amount,
    currency: payment.currency,
    raw: {
      manual: true,
      reference,
      note: (body.note ?? "").trim() || undefined,
      at: new Date().toISOString(),
    },
  });

  console.log(
    `[payment] manually settled order=${params.orderId} ref=${reference} result=${outcome.status}`,
  );
  return NextResponse.json({ ok: outcome.ok, status: outcome.status });
}
