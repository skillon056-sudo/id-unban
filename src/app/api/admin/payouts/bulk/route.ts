import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { payoutRequestSchema } from "@/lib/validation";
import { splitAmount } from "@/lib/split-amount";
import { payoutsConfigured } from "@/services/payment/payout";
import { startBatch, GAP_MS } from "@/services/payment/batch-payout";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkSchema = z.intersection(
  payoutRequestSchema,
  z.object({
    min: z.number().int().min(1).max(500000).optional(),
    max: z.number().int().min(1).max(500000).optional(),
    dryRun: z.boolean().optional(),
    gapSeconds: z.number().int().min(5).max(300).optional(),
  }),
);

// Sends one withdrawal as several smaller payouts to the same destination.
// Chunks run from ₹200 up to ₹5,000, all different and at least ₹200 apart.
//
// dryRun returns the plan without moving anything, so the operator sees exactly
// what will go out before confirming. The real run sends them one at a time and
// stops at the first refusal rather than pushing the rest — a channel that
// rejected one chunk will usually reject the next, and half a batch is easier
// to reason about than a scattered one.
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
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Check the payout details." },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const min = d.min ?? 200;
  const max = d.max ?? 5000;
  if (max < min) {
    return NextResponse.json({ error: "Smallest must not exceed largest." }, { status: 400 });
  }

  let chunks: number[];
  try {
    chunks = splitAmount(d.amount, { min, max });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not split that amount." },
      { status: 400 },
    );
  }

  if (d.dryRun) {
    return NextResponse.json({ plan: chunks, total: d.amount, count: chunks.length });
  }

  const gapMs = (d.gapSeconds ?? GAP_MS / 1000) * 1000;
  const batchId = `B${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;

  // Queue every chunk up front, then hand the batch to the background runner.
  // Sending them here would mean holding the request open for minutes — the
  // gap between payouts is deliberate, because back-to-back ones get parked as
  // pending by the gateway instead of being picked up.
  await prisma.$transaction(
    chunks.map((amount, i) =>
      prisma.payout.create({
        data: {
          payoutId: `PO${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}${i}`,
          batchId,
          amount,
          method: d.method,
          beneficiaryName: d.beneficiaryName,
          beneficiaryAccount: d.beneficiaryAccount,
          ifsc: d.method === "bank" ? d.ifsc : null,
          bankName: d.method === "bank" ? d.bankName ?? null : null,
          note: `${d.note ? `${d.note} — ` : ""}part ${i + 1} of ${chunks.length}`,
          gapMs: gapMs,
          status: "QUEUED",
        },
      }),
    ),
  );

  startBatch(batchId);
  console.log(`[payout] batch=${batchId} queued ${chunks.length} payouts, ${gapMs / 1000}s apart`);

  return NextResponse.json({
    batchId,
    planned: chunks.length,
    queued: chunks.length,
    total: d.amount,
    gapSeconds: gapMs / 1000,
  });
}
