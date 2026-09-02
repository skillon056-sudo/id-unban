import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refundUpdateSchema } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PUT /api/admin/refunds/:orderId — move a refund along and record the payout
// reference. COMPLETED is an operator assertion that money actually went out;
// nothing here sends funds on its own.
export async function PUT(
  req: Request,
  { params }: { params: { orderId: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = refundUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const existing = await prisma.refund.findUnique({ where: { orderId: params.orderId } });
  if (!existing) return NextResponse.json({ error: "Refund not found." }, { status: 404 });

  // A refund can only be completed against a deposit that actually cleared.
  if (parsed.data.status === "COMPLETED") {
    const deposit = await prisma.payment.findUnique({
      where: { orderId: params.orderId },
      select: { status: true },
    });
    if (deposit?.status !== "SUCCESS") {
      return NextResponse.json(
        { error: "That deposit never cleared — there is nothing to refund." },
        { status: 409 },
      );
    }
    if (!(parsed.data.reference ?? existing.reference)) {
      return NextResponse.json(
        { error: "Add the payout reference (UTR) before marking it completed." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.refund.update({
    where: { orderId: params.orderId },
    data: {
      status: parsed.data.status ?? undefined,
      reference:
        parsed.data.reference === undefined ? undefined : parsed.data.reference || null,
      notes: parsed.data.notes === undefined ? undefined : parsed.data.notes || null,
      refundedAt:
        parsed.data.status === "COMPLETED" && !existing.refundedAt ? new Date() : undefined,
    },
  });

  console.log(`[refund] order=${params.orderId} status=${updated.status}`);
  return NextResponse.json(updated);
}
