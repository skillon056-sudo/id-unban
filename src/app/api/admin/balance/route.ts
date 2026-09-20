import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// What is actually available at the gateway.
//
// The gateway exposes no balance endpoint — every documented path 404s — but it
// reports fee and net_amount on each payment, and fee and debit on each payout.
// So the figure is built from what it told us: money in, minus money already
// sent out. Payouts made from the gateway's own dashboard count too; they are
// recorded from their callbacks.
//
// Auth enforced by middleware for /api/admin/*.
export async function GET() {
  const [collected, out] = await Promise.all([
    prisma.$queryRaw<{ gross: number | null; net: number | null; count: bigint }[]>`
      select
        sum(amount)::float as gross,
        sum(coalesce(
          (regexp_match("gatewayResponse", '"net_amount":"?([0-9.]+)'))[1]::numeric,
          amount
        ))::float as net,
        count(*) as count
      from "Payment"
      where status = 'SUCCESS' and amount > 0
    `,
    prisma.$queryRaw<{ sent: number | null; count: bigint }[]>`
      select
        sum(coalesce(debit, amount + coalesce(fee, 0)))::float as sent,
        count(*) as count
      from "Payout"
      where status in ('SENT', 'COMPLETED')
    `,
  ]);

  const net = collected[0]?.net ?? 0;
  const gross = collected[0]?.gross ?? 0;
  const sent = out[0]?.sent ?? 0;

  return NextResponse.json({
    configured: true,
    collectedGross: Math.round(gross),
    collectedNet: Math.round(net),
    gatewayFees: Math.round(gross - net),
    paidOut: Math.round(sent),
    available: Math.round(net - sent),
    payments: Number(collected[0]?.count ?? 0),
    payouts: Number(out[0]?.count ?? 0),
  });
}
