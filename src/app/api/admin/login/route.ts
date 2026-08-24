import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { createSessionToken, setSessionCookie, sameOrigin } from "@/lib/auth";
import { checkRate, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  // Brute-force protection: 5 attempts / 5 min per IP.
  const rl = checkRate(`login:${clientIp(req)}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  // Constant-ish work whether or not the user exists.
  const hash = admin?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv";
  const valid = await bcrypt.compare(parsed.data.password, hash);

  if (!admin || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSessionToken({ sub: admin.id, email: admin.email });
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
