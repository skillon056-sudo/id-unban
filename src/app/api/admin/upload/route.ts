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
};
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

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
    return NextResponse.json({ error: "Only JPG, PNG, WEBP, GIF or AVIF images are allowed." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 6 MB)." }, { status: 413 });
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
      { error: "File uploads aren't supported on this host. Paste an image URL instead." },
      { status: 501 },
    );
  }

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
