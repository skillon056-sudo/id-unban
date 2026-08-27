"use client";

// Thin wrapper over fbq. Every call is a no-op when the pixel didn't load
// (blocked, ad-blocker, pixel id not set), so tracking can never break checkout.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

/**
 * Advanced matching: re-init with the customer's email so Meta can attribute
 * the conversion. fbq hashes it in the browser — the raw value never leaves.
 */
export function identify(email?: string | null) {
  if (!email || !PIXEL_ID) return;
  try {
    window.fbq?.("init", PIXEL_ID, { em: email.trim().toLowerCase() });
  } catch {
    /* tracking must never throw */
  }
}

export function track(event: string, params?: Record<string, unknown>, eventID?: string) {
  try {
    window.fbq?.("track", event, params ?? {}, eventID ? { eventID } : undefined);
  } catch {
    /* tracking must never throw */
  }
}

/**
 * Fires an event at most once per key, surviving refreshes — so a reload of the
 * success page can't report a second Purchase.
 */
export function trackOnce(
  key: string,
  event: string,
  params?: Record<string, unknown>,
) {
  const storageKey = `fbq_sent_${key}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, "1");
  } catch {
    // Storage blocked — fall through and fire; eventID still dedupes server-side.
  }
  track(event, params, key);
}
