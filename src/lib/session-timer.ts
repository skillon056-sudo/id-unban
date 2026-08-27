"use client";

import { useEffect, useState } from "react";

// Per-visitor session window. The end timestamp is generated once and stored,
// so refreshing, navigating or sleeping the device never restarts it.
//
// Display only: this is a UX session window, not a security boundary. Anything
// that must actually be enforced is checked server-side (see the appeal API).

const KEY = "ff_session_end";
const MIN_MS = 15 * 60 * 60 * 1000; // 15h
const MAX_MS = 20 * 60 * 60 * 1000; // 20h

function readEnd(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const end = Number(raw);
    // Reject junk, and anything further out than a full window (stale/tampered).
    if (!Number.isFinite(end) || end <= 0 || end > Date.now() + MAX_MS) return null;
    return end;
  } catch {
    return null; // private mode / storage blocked
  }
}

function createEnd(): number {
  const end = Date.now() + MIN_MS + Math.random() * (MAX_MS - MIN_MS);
  try {
    localStorage.setItem(KEY, String(end));
  } catch {
    /* storage blocked — the timer still runs for this page view */
  }
  return end;
}

export interface SessionTimer {
  /** null until mounted on the client, to avoid a hydration mismatch. */
  remainingMs: number | null;
  expired: boolean;
}

export function useSessionTimer(): SessionTimer {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const e = readEnd() ?? createEnd();
    setEnd(e);
    setNow(Date.now());

    // Recompute from the clock every tick, never by decrementing a counter —
    // so a slept/backgrounded tab catches up instantly on wake.
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  if (end == null || now == null) return { remainingMs: null, expired: false };
  const remainingMs = Math.max(0, end - now);
  return { remainingMs, expired: remainingMs === 0 };
}

export function splitTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    hh: String(Math.floor(total / 3600)).padStart(2, "0"),
    mm: String(Math.floor((total % 3600) / 60)).padStart(2, "0"),
    ss: String(total % 60).padStart(2, "0"),
  };
}
