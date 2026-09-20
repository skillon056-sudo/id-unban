import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { payoutStatus } from "@/services/payment/payout";

export const dynamic = "force-dynamic";

// GET — ask the gateway where this payout stands and record the answer.
export async function GET(
  _req: Request,
  { params }: { params: { payoutId: string } },
) {
  const row = await prisma.payout.findUnique({ where: { payoutId: params.payoutId } });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const s = await payoutStatus(params.payoutId);
  if (!s.ok) return NextResponse.json({ status: row.status, error: s.error });

  const raw: any = s.raw ?? {};
  const done = /success|complete|paid|settle/i.test(s.status ?? "");
  const failed = /fail|reject|declin|cancel|return/i.test(s.status ?? "");

  const updated = await prisma.payout.update({
    where: { payoutId: params.payoutId },
    data: {
      gatewayStatus: s.status,
      utr: raw.utr || row.utr,
      status: done ? "COMPLETED" : failed ? "FAILED" : row.status,
      settledAt: done && !row.settledAt ? new Date() : row.settledAt,
    },
  });
  return NextResponse.json({ payout: updated });
}
