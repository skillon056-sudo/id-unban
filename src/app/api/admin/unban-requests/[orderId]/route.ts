import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { caseUpdateSchema } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PUT /api/admin/unban-requests/:orderId — move the case along, add notes.
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
  const parsed = caseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const existing = await prisma.unbanRequest.findUnique({ where: { orderId: params.orderId } });
  if (!existing) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const updated = await prisma.unbanRequest.update({
    where: { orderId: params.orderId },
    data: {
      status: parsed.data.status ?? undefined,
      adminNotes:
        parsed.data.adminNotes === undefined ? undefined : parsed.data.adminNotes || null,
      // Stamp the moment the appeal actually went to Garena.
      filedAt:
        parsed.data.status === "FILED" && !existing.filedAt ? new Date() : undefined,
    },
  });
  return NextResponse.json(updated);
}
