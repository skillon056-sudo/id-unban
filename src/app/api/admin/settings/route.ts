import { NextResponse } from "next/server";
import { getSettings, setSetting } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";
import { sameOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings(true);
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid settings." },
      { status: 400 },
    );
  }

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) await setSetting(key, String(value));
  }
  const settings = await getSettings(true);
  return NextResponse.json(settings);
}
