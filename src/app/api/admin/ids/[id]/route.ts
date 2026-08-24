import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { idUpdateSchema } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PUT /api/admin/ids/:id
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = idUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid data." },
      { status: 400 },
    );
  }

  const existing = await prisma.freeFireId.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Guard against gameId collision when changed.
  if (parsed.data.gameId && parsed.data.gameId !== existing.gameId) {
    const clash = await prisma.freeFireId.findUnique({ where: { gameId: parsed.data.gameId } });
    if (clash) return NextResponse.json({ error: "That Free Fire ID already exists." }, { status: 409 });
  }

  const updated = await prisma.freeFireId.update({
    where: { id: params.id },
    data: {
      gameId: parsed.data.gameId ?? undefined,
      status: parsed.data.status ?? undefined,
      banReason: parsed.data.banReason === undefined ? undefined : parsed.data.banReason || null,
      unbanEnabled: parsed.data.unbanEnabled ?? undefined,
      freeUnban: parsed.data.freeUnban ?? undefined,
      price: parsed.data.price === undefined ? undefined : parsed.data.price || null,
      unbanLeft: parsed.data.unbanLeft === undefined ? undefined : parsed.data.unbanLeft ?? null,
      notes: parsed.data.notes === undefined ? undefined : parsed.data.notes || null,
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/ids/:id
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  const existing = await prisma.freeFireId.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.freeFireId.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
