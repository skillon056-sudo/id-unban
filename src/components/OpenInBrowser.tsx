"use client";

import { useState } from "react";
import { detectInApp, chromeIntentUrl } from "@/lib/in-app-browser";

// Shown when the payment page can't work in the current (in-app) browser.
// Gives the user a one-tap escape on Android and a copy-link fallback everywhere.
export function OpenInBrowser({ url }: { url: string }) {
  const { app, isAndroid, isIOS } = detectInApp();
  const [copied, setCopied] = useState(false);
  const intent = isAndroid ? chromeIntentUrl(url) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older WebViews: fall back to a hidden textarea.
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try */
      }
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="mt-4 rounded-xl border border-accent/50 bg-accent/10 p-4 animate-fade-up">
      <p className="text-sm font-semibold text-ink">Open in your browser to pay</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        {app ? `${app}'s built-in browser` : "This in-app browser"} can&apos;t open UPI
        apps, so payment won&apos;t complete here. Your request is saved — continue in
        Chrome or Safari.
      </p>

      {intent && (
        <a href={intent} className="btn-primary mt-3 flex w-full text-sm">
          Open in Chrome
        </a>
      )}

      {isIOS && (
        <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-slate-700">
          Tap the <span className="font-semibold">•••</span> menu at the top right, then{" "}
          <span className="font-semibold">Open in browser</span>.
        </p>
      )}

      <button type="button" onClick={copy} className="btn-ghost mt-2 w-full text-sm">
        {copied ? "Link copied ✓" : "Copy payment link"}
      </button>

      <p className="mt-2 break-all text-[0.65rem] text-muted">{url}</p>
    </div>
  );
}
