import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { idInputSchema } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/ids?search=&status=&page=
export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.toUpperCase() || "ALL";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const take = 20;

  const where: Prisma.FreeFireIdWhereInput = {};
  if (search) where.gameId = { contains: search };
  if (["BANNED", "UNBANNED", "PENDING"].includes(status)) where.status = status;

  const [items, total] = await Promise.all([
    prisma.freeFireId.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.freeFireId.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize: take });
}

// POST /api/admin/ids
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = idInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid data." },
      { status: 400 },
    );
  }

  const exists = await prisma.freeFireId.findUnique({ where: { gameId: parsed.data.gameId } });
  if (exists) {
    return NextResponse.json({ error: "This Free Fire ID already exists." }, { status: 409 });
  }

  const created = await prisma.freeFireId.create({
    data: {
      gameId: parsed.data.gameId,
      status: parsed.data.status,
      banReason: parsed.data.banReason || null,
      unbanEnabled: parsed.data.unbanEnabled,
      price: parsed.data.price ?? null,
      notes: parsed.data.notes || null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
