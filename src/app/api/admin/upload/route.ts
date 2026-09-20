import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  // Voice notes. Phones record m4a (iPhone) or ogg/opus (WhatsApp, Android).
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
};
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;  // 6 MB
const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB — a few minutes of voice

// POST multipart/form-data with field "file". Saves to /public/uploads and
// returns { url }. Auth enforced by middleware for /api/admin/*.
// ponytail: local disk storage. On serverless (Vercel) the filesystem is
// ephemeral — swap writeFile for S3/Cloudinary upload if you deploy there.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Allowed: JPG, PNG, WEBP, GIF, AVIF images, or MP3, M4A, OGG, WAV audio." },
      { status: 415 },
    );
  }
  const isAudio = file.type.startsWith("audio/");
  const limit = isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { error: `File is too large (max ${limit / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
  } catch {
    // Serverless hosts (Vercel) have a read-only filesystem — file uploads
    // can't persist. Paste an image URL instead, or add a blob store.
    return NextResponse.json(
      { error: "File uploads aren't supported on this host. Paste a URL instead." },
      { status: 501 },
    );
  }

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
