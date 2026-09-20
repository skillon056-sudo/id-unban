"use client";

import { useEffect, useState } from "react";

// Time left to finish this step. The deadline is set on the server the first
// time the page is opened, so reloading or opening a second tab shows the same
// remaining time rather than a fresh one.
export function DepositCountdown({ deadline }: { deadline: string }) {
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState(() => end - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const ms = end - Date.now();
      setLeft(ms);
      // Server decides what an expired step looks like.
      if (ms <= 0) window.location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, [end]);

  const s = Math.max(0, Math.ceil(left / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");

  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-amber-900">
        Time left to complete this step
      </span>
      <span className="font-display text-2xl font-extrabold tabular-nums text-amber-900">
        {mm}:{ss}
      </span>
    </div>
  );
}
