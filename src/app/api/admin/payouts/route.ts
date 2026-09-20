import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { payoutRequestSchema } from "@/lib/validation";
import { sendPayout, payoutsConfigured } from "@/services/payment/payout";

export const dynamic = "force-dynamic";

// GET — recent payouts. Auth enforced by middleware for /api/admin/*.
export async function GET() {
  const items = await prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const sent = await prisma.payout.aggregate({
    _sum: { amount: true },
    where: { status: { in: ["SENT", "COMPLETED"] } },
  });
  return NextResponse.json({ items, configured: payoutsConfigured(), totalSent: sent._sum.amount ?? 0 });
}

// POST — send money out. The row is written before the gateway call, because a
// timeout may still mean the money moved; it is never silently retried.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  if (!payoutsConfigured()) {
    return NextResponse.json({ error: "Payouts are not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = payoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the payout details." },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const payoutId = `PO${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;

  const row = await prisma.payout.create({
    data: {
      payoutId,
      amount: d.amount,
      method: d.method,
      beneficiaryName: d.beneficiaryName,
      beneficiaryAccount: d.beneficiaryAccount,
      ifsc: d.method === "bank" ? d.ifsc : null,
      bankName: d.method === "bank" ? d.bankName ?? null : null,
      note: d.note ?? null,
      status: "PENDING",
    },
  });

  const result = await sendPayout({
    payoutId,
    amount: d.amount,
    method: d.method,
    beneficiaryName: d.beneficiaryName,
    beneficiaryAccount: d.beneficiaryAccount,
    ifsc: d.method === "bank" ? d.ifsc : undefined,
    bankName: d.method === "bank" ? d.bankName : undefined,
  });

  if (!result.ok) {
    await prisma.payout.update({
      where: { id: row.id },
      data: { status: "FAILED", error: result.error?.slice(0, 300) },
    });
    console.error(`[payout] refused payout=${payoutId} amount=${d.amount}: ${result.error}`);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const updated = await prisma.payout.update({
    where: { id: row.id },
    data: { status: "SENT", gatewayStatus: result.status ?? "pending" },
  });
  console.log(`[payout] sent payout=${payoutId} amount=${d.amount} to=${d.beneficiaryAccount}`);
  return NextResponse.json({ ok: true, payout: updated });
}
