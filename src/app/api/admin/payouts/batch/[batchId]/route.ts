import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { startBatch, isRunning, GAP_MS } from "@/services/payment/batch-payout";

export const dynamic = "force-dynamic";

// GET — how far the batch has got. Auth enforced by middleware for /api/admin/*.
export async function GET(
  _req: Request,
  { params }: { params: { batchId: string } },
) {
  const rows = await prisma.payout.findMany({
    where: { batchId: params.batchId },
    orderBy: { createdAt: "asc" },
    select: {
      payoutId: true,
      amount: true,
      status: true,
      gatewayStatus: true,
      error: true,
      gapMs: true,
      updatedAt: true,
    },
  });
  if (rows.length === 0) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const sent = rows.filter((r) => r.status === "SENT" || r.status === "COMPLETED");

  // When the next queued payout is due: the last one's send time plus the gap.
  const gapMs = rows[0]?.gapMs ?? GAP_MS;
  const lastSentAt = sent.reduce<Date | null>(
    (latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest),
    null,
  );
  const nextAt =
    count("QUEUED") > 0 && lastSentAt ? new Date(lastSentAt.getTime() + gapMs) : null;

  return NextResponse.json({
    batchId: params.batchId,
    running: isRunning(params.batchId),
    gapSeconds: gapMs / 1000,
    nextAt: nextAt?.toISOString() ?? null,
    total: rows.length,
    queued: count("QUEUED"),
    sent: sent.length,
    failed: count("FAILED"),
    cancelled: count("CANCELLED"),
    sentAmount: sent.reduce((a, r) => a + r.amount, 0),
    plannedAmount: rows.reduce((a, r) => a + r.amount, 0),
    rows,
  });
}

// POST — resume a batch the process stopped mid-way (a restart, or a refusal
// that has since been sorted out). Only queued rows are picked up.
export async function POST(
  req: Request,
  { params }: { params: { batchId: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let action = "resume";
  try {
    action = ((await req.json()) as { action?: string })?.action ?? "resume";
  } catch {
    /* default */
  }

  if (action === "cancel") {
    const c = await prisma.payout.updateMany({
      where: { batchId: params.batchId, status: "QUEUED" },
      data: { status: "CANCELLED" },
    });
    console.log(`[payout] batch=${params.batchId} cancelled ${c.count} queued payouts`);
    return NextResponse.json({ cancelled: c.count });
  }

  const queued = await prisma.payout.count({
    where: { batchId: params.batchId, status: "QUEUED" },
  });
  if (queued === 0) return NextResponse.json({ error: "Nothing left to send." }, { status: 409 });

  startBatch(params.batchId);
  return NextResponse.json({ resuming: queued });
}
