import { NextResponse } from "next/server";
import { merchantBalance, payoutsConfigured } from "@/services/payment/payout";

export const dynamic = "force-dynamic";

// Auth enforced by middleware for /api/admin/*.
export async function GET() {
  if (!payoutsConfigured()) {
    return NextResponse.json({ configured: false });
  }
  const r = await merchantBalance();
  // This gateway has no balance endpoint (every documented path 404s), so a
  // failure here is expected and not worth showing as an error.
  const unsupported = /not found/i.test(r.error ?? "");
  return NextResponse.json({
    configured: true,
    ok: r.ok,
    balance: r.balance,
    ...(r.ok ? {} : unsupported ? { unsupported: true } : { error: r.error }),
  });
}
