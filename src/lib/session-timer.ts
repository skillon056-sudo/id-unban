"use client";

import { useEffect, useState } from "react";

// Per-visitor session window. The end timestamp is generated once and stored,
// so refreshing, navigating or sleeping the device never restarts it.
//
// Display only. Nothing on the site is gated on this — the server stays
// authoritative for search, payments and every other business rule.

const KEY = "ff_session_end";
const MIN_MS = 40 * 60 * 60 * 1000; // 40h
const MAX_MS = 48 * 60 * 60 * 1000; // 48h

function readEnd(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const end = Number(raw);
    // Reject junk, and anything beyond a full window (stale or tampered).
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
}

export function useSessionTimer(): SessionTimer {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let current = readEnd() ?? createEnd();
    setEnd(current);
    setNow(Date.now());

    // Recompute from the clock every tick, never by decrementing a counter —
    // so a slept or backgrounded tab catches up instantly on wake.
    const tick = () => {
      const t = Date.now();
      // Window elapsed: roll straight into a fresh one. The site never closes.
      if (t >= current) {
        current = createEnd();
        setEnd(current);
      }
      setNow(t);
    };

    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  if (end == null || now == null) return { remainingMs: null };
  return { remainingMs: Math.max(0, end - now) };
}

/** Splits a duration into padded H:M:S. Hours can exceed 24. */
export function splitTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    hh: String(Math.floor(total / 3600)).padStart(2, "0"),
    mm: String(Math.floor((total % 3600) / 60)).padStart(2, "0"),
    ss: String(total % 60).padStart(2, "0"),
  };
}
