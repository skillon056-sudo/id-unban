"use client";

import { useEffect, useState } from "react";
import { detectInApp, chromeIntentUrl } from "@/lib/in-app-browser";

// Instagram/Facebook/TikTok webviews can't hand off to a UPI app, so a payment
// started there dead-ends. Catch it on arrival: Android gets pushed straight to
// Chrome, iOS gets the manual route (Apple gives webviews no way to force it).
//
// Dismissible on purpose — nobody should be locked out of the page.
const TRIED_KEY = "ff_ext_redirect_tried";

export function InAppBrowserGate() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const info = detectInApp();
    if (!info.isInApp) return;

    const here = window.location.href;
    setUrl(here);
    setIsIOS(info.isIOS);
    setShow(true);

    // Android: one automatic attempt per session, so a failed hand-off can't
    // trap the user in a redirect loop.
    if (info.isAndroid) {
      let tried = false;
      try {
        tried = sessionStorage.getItem(TRIED_KEY) === "1";
        sessionStorage.setItem(TRIED_KEY, "1");
      } catch {
        /* storage blocked — fall through to the manual button */
      }
      const intent = chromeIntentUrl(here);
      if (!tried && intent) {
        // Small delay so the page paints first; an instant navigation from a
        // blank screen looks like a crash.
        setTimeout(() => {
          window.location.href = intent;
        }, 600);
      }
    }
  }, []);

  if (!show) return null;

  const intent = chromeIntentUrl(url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div className="card w-full max-w-sm p-6 text-center animate-fade-up">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl">
          🌐
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Open in your browser</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This in-app browser can&apos;t open UPI apps, so payments won&apos;t
          complete here. Continue in Chrome or Safari.
        </p>

        {intent && (
          <a href={intent} className="btn-primary mt-5 flex w-full">
            Open in Chrome
          </a>
        )}

        {isIOS && (
          <p className="mt-5 rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-700">
            Tap the <span className="font-semibold">•••</span> menu at the top right,
            then <span className="font-semibold">Open in browser</span>.
          </p>
        )}

        <button onClick={copy} className="btn-ghost mt-2 w-full text-sm">
          {copied ? "Link copied ✓" : "Copy link"}
        </button>

        <button
          onClick={() => setShow(false)}
          className="mt-3 text-xs text-muted underline"
        >
          Continue here anyway
        </button>
      </div>
    </div>
  );
}
