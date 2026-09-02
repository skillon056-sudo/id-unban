import { NextResponse } from "next/server";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";

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

  const outcome = await settlePayment(verified);

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
