"use client";

// Which ad brought this visitor. Meta puts utm_* on the landing URL, but the
// customer may wander before paying, so the first set seen is kept and reused —
// first touch, not last, because that's the click the ad account paid for.
const KEY = "ff_campaign";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];

export type Campaign = Record<string, string>;

/** Call on landing. Keeps the first set of parameters seen. */
export function captureCampaign() {
  try {
    const q = new URLSearchParams(window.location.search);
    const found: Campaign = {};
    for (const f of FIELDS) {
      const v = q.get(f);
      if (v) found[f] = v.slice(0, 120);
    }
    if (Object.keys(found).length === 0) return;

    const existing = readRaw();
    // Don't overwrite a still-valid first touch.
    if (existing) return;
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), c: found }));
  } catch {
    /* storage or URL unavailable — attribution is best effort */
  }
}

function readRaw(): Campaign | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved?.c || !saved.t || Date.now() - saved.t > MAX_AGE_MS) return null;
    return saved.c as Campaign;
  } catch {
    return null;
  }
}

/** Parameters to send with a checkout: whatever is in the URL now, else the first touch. */
export function readCampaign(): Campaign {
  const now: Campaign = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const f of FIELDS) {
      const v = q.get(f);
      if (v) now[f] = v.slice(0, 120);
    }
  } catch {
    /* ignore */
  }
  return Object.keys(now).length ? now : readRaw() ?? {};
}
