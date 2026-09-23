import { getGateway } from "@/services/payment";
import { settlePayment } from "@/services/payment/settle";

export const dynamic = "force-dynamic";

// Where the gateway sends the browser after checkout.
//
// A plain path, no query string: the gateway quietly stopped redirecting when
// the return URL carried one. Keeping it a separate path also makes returns
// countable in the access log, which is what the query parameter was for.
const back = (orderId: string) =>
  new Response(null, { status: 303, headers: { Location: `/appeal/${encodeURIComponent(orderId)}` } });

export function GET(_req: Request, { params }: { params: { orderId: string } }) {
  return back(params.orderId);
}

// Rupayex POSTs its (unsigned) result here. Treat it as a nudge only: the order
// is re-checked with the gateway before anything settles. A deposit calls back
// on its parent's path, so the order id comes from the body.
export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const text = await req.text().catch(() => "");
  let body: any = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = Object.fromEntries(new URLSearchParams(text));
  }
  const orderId = String(body?.order_id || params.orderId);
  try {
    const v = await getGateway().verifyPayment(orderId);
    if (v.status !== "PENDING") await settlePayment(v);
    console.log(`[return] callback order=${orderId} status=${v.status}`);
  } catch (err) {
    console.error(`[return] callback order=${orderId} failed:`, err instanceof Error ? err.message : err);
  }
  return back(params.orderId);
}
