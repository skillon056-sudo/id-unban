// YouTube helpers. Thumbnails come from YouTube's own CDN and titles from the
// public oEmbed endpoint — both keyless, so no API quota to manage.

export interface VideoCard {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  duration: string; // operator-supplied; oEmbed doesn't expose length
}

/** Pulls the 11-char video id out of any common YouTube URL shape. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  // Bare id pasted on its own.
  if (/^[\w-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      // /shorts/ID, /embed/ID, /live/ID
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export const thumbnailUrl = (id: string) =>
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Title via oEmbed. Returns null on any failure — the caller falls back. */
export async function fetchTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(id))}&format=json`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const body: any = await res.json();
    return typeof body?.title === "string" ? body.title : null;
  } catch {
    return null;
  }
}

/**
 * Builds the cards from settings. Slots are video_1_url … video_3_url, each
 * with an optional video_N_duration and video_N_title override.
 */
export async function buildVideoCards(
  settings: Record<string, string>,
): Promise<VideoCard[]> {
  const slots = [1, 2, 3]
    .map((n) => ({
      id: youtubeId(settings[`video_${n}_url`] ?? ""),
      duration: (settings[`video_${n}_duration`] ?? "").trim(),
      title: (settings[`video_${n}_title`] ?? "").trim(),
    }))
    .filter((s): s is { id: string; duration: string; title: string } => Boolean(s.id));

  // Titles in parallel; an operator-set title always wins.
  const titles = await Promise.all(
    slots.map((s) => (s.title ? Promise.resolve(s.title) : fetchTitle(s.id))),
  );

  return slots.map((s, i) => ({
    id: s.id,
    url: watchUrl(s.id),
    title: titles[i] || "Watch video",
    thumbnail: thumbnailUrl(s.id),
    duration: s.duration,
  }));
}
