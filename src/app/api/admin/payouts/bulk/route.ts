import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/auth";
import { payoutRequestSchema } from "@/lib/validation";
import { splitAmount } from "@/lib/split-amount";
import { sendPayout, payoutsConfigured } from "@/services/payment/payout";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkSchema = z.intersection(
  payoutRequestSchema,
  z.object({
    min: z.number().int().min(1).max(500000).optional(),
    max: z.number().int().min(1).max(500000).optional(),
    dryRun: z.boolean().optional(),
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

  const batchId = `B${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
  const results: { payoutId: string; amount: number; ok: boolean; error?: string }[] = [];

  for (const [i, amount] of chunks.entries()) {
    const payoutId = `PO${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;

    // Written before the call: a timeout can still mean the money moved.
    const row = await prisma.payout.create({
      data: {
        payoutId,
        batchId,
        amount,
        method: d.method,
        beneficiaryName: d.beneficiaryName,
        beneficiaryAccount: d.beneficiaryAccount,
        ifsc: d.method === "bank" ? d.ifsc : null,
        bankName: d.method === "bank" ? d.bankName ?? null : null,
        note: `${d.note ? `${d.note} — ` : ""}part ${i + 1} of ${chunks.length}`,
        status: "PENDING",
      },
    });

    const r = await sendPayout({
      payoutId,
      amount,
      method: d.method,
      beneficiaryName: d.beneficiaryName,
      beneficiaryAccount: d.beneficiaryAccount,
      ifsc: d.method === "bank" ? d.ifsc : undefined,
      bankName: d.method === "bank" ? d.bankName : undefined,
    });

    if (!r.ok) {
      await prisma.payout.update({
        where: { id: row.id },
        data: { status: "FAILED", error: r.error?.slice(0, 300) },
      });
      results.push({ payoutId, amount, ok: false, error: r.error });
      console.error(`[payout] batch=${batchId} stopped at part ${i + 1}: ${r.error}`);
      break;
    }

    await prisma.payout.update({
      where: { id: row.id },
      data: { status: "SENT", gatewayStatus: r.status ?? "pending" },
    });
    results.push({ payoutId, amount, ok: true });

    // A short gap keeps the channel from seeing a burst.
    if (i < chunks.length - 1) await new Promise((res) => setTimeout(res, 800));
  }

  const sentTotal = results.filter((r) => r.ok).reduce((a, r) => a + r.amount, 0);
  console.log(
    `[payout] batch=${batchId} sent ${results.filter((r) => r.ok).length}/${chunks.length} = ₹${sentTotal}`,
  );

  return NextResponse.json({
    batchId,
    planned: chunks.length,
    sent: results.filter((r) => r.ok).length,
    sentTotal,
    requestedTotal: d.amount,
    results,
  });
}
