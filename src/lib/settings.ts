import { prisma } from "./db";

// Cached settings read. Non-secret config only — gateway secrets live in env.
let cache: Record<string, string> | null = null;
let cachedAt = 0;

export async function getSettings(force = false): Promise<Record<string, string>> {
  if (!force && cache && Date.now() - cachedAt < 30_000) return cache;
  const rows = await prisma.setting.findMany();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cachedAt = Date.now();
  return cache;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await getSettings();
  return s[key] ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  cache = null; // invalidate
}

export function invalidateSettings() {
  cache = null;
}
