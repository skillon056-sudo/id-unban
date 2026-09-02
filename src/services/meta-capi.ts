// Meta Conversions API — server-side Purchase reporting.
//
// The browser pixel can be blocked (ad blockers, closed tab, in-app browsers),
// so the same conversion is also sent from here. Both carry the SAME event_id
// (the order id), which is how Meta deduplicates them — see
// https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
//
// META_ACCESS_TOKEN is server-only and must never be exposed to the browser.

import { createHash } from "crypto";

const API_VERSION = "v21.0";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Meta requires user identifiers to be lowercase, trimmed and SHA-256 hashed. */
function hashed(value?: string | null): string[] | undefined {
  const v = value?.trim().toLowerCase();
  return v ? [sha256(v)] : undefined;
}

export interface PurchaseEvent {
  eventId: string; // must match the browser eventID — this is the dedup key
  value: number;
  currency: string;
  contentId: string;
  email?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  /** Meta browser cookies, when the request carried them. */
  fbp?: string | null;
  fbc?: string | null;
  sourceUrl?: string;
}

export async function sendPurchaseToMeta(e: PurchaseEvent): Promise<boolean> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !token) return false; // not configured — browser pixel still fires

  const userData: Record<string, unknown> = {};
  const em = hashed(e.email);
  if (em) userData.em = em;
  if (e.clientIp) userData.client_ip_address = e.clientIp;
  if (e.userAgent) userData.client_user_agent = e.userAgent;
  if (e.fbp) userData.fbp = e.fbp;
  if (e.fbc) userData.fbc = e.fbc;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: "website",
        ...(e.sourceUrl ? { event_source_url: e.sourceUrl } : {}),
        user_data: userData,
        custom_data: {
          value: e.value,
          currency: e.currency,
          content_type: "product",
          content_ids: [e.contentId],
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      },
    );
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Log the reason, never the token.
      console.error(
        `[capi] Purchase rejected event=${e.eventId} status=${res.status}`,
        body?.error?.message ?? "",
      );
      return false;
    }
    console.log(
      `[capi] Purchase sent event=${e.eventId} value=${e.value} ${e.currency} ` +
        `received=${body?.events_received ?? "?"}`,
    );
    return true;
  } catch (err) {
    console.error(
      `[capi] Purchase failed event=${e.eventId}:`,
      err instanceof Error ? err.message : err,
    );
    return false; // reporting must never break the payment flow
  }
}
