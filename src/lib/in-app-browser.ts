"use client";

// In-app browsers (Instagram, Facebook, Snapchat, TikTok…) run a stripped
// WebView that usually can't hand off to a UPI app, so payment pages silently
// fail there. Detect it so we can route the user to a real browser first.

export interface InAppInfo {
  isInApp: boolean;
  /** Friendly app name, when we can tell. */
  app: string | null;
  isAndroid: boolean;
  isIOS: boolean;
}

const APPS: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/Snapchat/i, "Snapchat"],
  [/musical_ly|Bytedance|TikTok/i, "TikTok"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Twitter/i, "X"],
  [/MicroMessenger/i, "WeChat"],
  [/\bLine\//i, "LINE"],
  [/Pinterest/i, "Pinterest"],
];

export function detectInApp(ua?: string): InAppInfo {
  const s = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isAndroid = /Android/i.test(s);
  const isIOS = /iPhone|iPad|iPod/i.test(s);

  for (const [re, app] of APPS) {
    if (re.test(s)) return { isInApp: true, app, isAndroid, isIOS };
  }

  // Generic Android WebView: has "wv" or lacks a real browser token.
  if (isAndroid && /; wv\)/i.test(s)) {
    return { isInApp: true, app: null, isAndroid, isIOS };
  }
  return { isInApp: false, app: null, isAndroid, isIOS };
}

// Android can jump straight to Chrome via an intent: URL. iOS WebViews have no
// reliable equivalent, so there the user taps "Open in browser" themselves.
export function chromeIntentUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end;`;
  } catch {
    return null;
  }
}
