import { prisma } from "@/lib/db";
import { sendPayout } from "./payout";

// Runs a batch of payouts one at a time, spaced out.
//
// Sending them back to back makes the gateway park them as "pending" instead of
// picking them up, so each one waits for the gap before the next goes. That
// makes a batch take minutes, which is far longer than a request can be held
// open — so the API starts this and returns, and the page watches the rows.
//
// The queue lives in the database, not in memory: if the process restarts
// mid-batch the remaining rows are still QUEUED and can be resumed.

export const GAP_MS = Number(process.env.BULK_PAYOUT_GAP_MS || 20000);

// Batches already running in this process, so a second call can't double-send.
const running = new Set<string>();

export function isRunning(batchId: string) {
  return running.has(batchId);
}

export async function runBatch(batchId: string): Promise<void> {
  if (running.has(batchId)) return;
  running.add(batchId);

  try {
    // Re-read each time: a row may have been cancelled while we waited.
    for (;;) {
      const next = await prisma.payout.findFirst({
        where: { batchId, status: "QUEUED" },
        orderBy: { createdAt: "asc" },
      });
      if (!next) break;

      // Claim it first, so a resume triggered meanwhile can't send it too.
      const claimed = await prisma.payout.updateMany({
        where: { id: next.id, status: "QUEUED" },
        data: { status: "PENDING" },
      });
      if (claimed.count !== 1) continue;

      const r = await sendPayout({
        payoutId: next.payoutId,
        amount: next.amount,
        method: next.method as "upi" | "bank",
        beneficiaryName: next.beneficiaryName,
        beneficiaryAccount: next.beneficiaryAccount,
        ifsc: next.ifsc ?? undefined,
        bankName: next.bankName ?? undefined,
      });

      if (!r.ok) {
        await prisma.payout.update({
          where: { id: next.id },
          data: { status: "FAILED", error: r.error?.slice(0, 300) },
        });
        // Stop the batch: a channel that refused one will usually refuse the
        // next, and the rest stay QUEUED for a deliberate resume.
        console.error(`[payout] batch=${batchId} stopped on ${next.payoutId}: ${r.error}`);
        break;
      }

      await prisma.payout.update({
        where: { id: next.id },
        data: { status: "SENT", gatewayStatus: r.status ?? "pending" },
      });
      console.log(`[payout] batch=${batchId} sent ${next.payoutId} ₹${next.amount}`);

      const more = await prisma.payout.count({ where: { batchId, status: "QUEUED" } });
      if (more === 0) break;
      await new Promise((res) => setTimeout(res, next.gapMs ?? GAP_MS));
    }
  } finally {
    running.delete(batchId);
  }
}

/** Kick a batch off without holding the caller. */
export function startBatch(batchId: string) {
  void runBatch(batchId).catch((err) =>
    console.error(`[payout] batch=${batchId} crashed:`, err),
  );
}
