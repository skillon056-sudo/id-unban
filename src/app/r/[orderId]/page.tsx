import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Where the gateway sends the browser after checkout.
//
// A plain path, no query string: the gateway quietly stopped redirecting when
// the return URL carried one. Keeping it a separate path also makes returns
// countable in the access log, which is what the query parameter was for.
export default function GatewayReturn({ params }: { params: { orderId: string } }) {
  redirect(`/appeal/${encodeURIComponent(params.orderId)}`);
}
