import { NextResponse } from "next/server";
import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";

export const dynamic = "force-dynamic";

// Gateway -> our server. The gateway implementation authenticates the request
// (signature verification) inside handleWebhook. We never trust a browser
// success redirect; only this server-verified path settles a payment.
export async function POST(req: Request) {
  const gateway = getGateway();
  let verified;
  try {
    verified = await gateway.handleWebhook(req);
  } catch (err) {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  const outcome = await settlePayment(verified);
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, reason: outcome.reason }, { status: 200 });
  }
  return NextResponse.json({ ok: true, status: outcome.status });
}
