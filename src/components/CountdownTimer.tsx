"use client";

import { useSessionTimer, splitTime } from "@/lib/session-timer";

// Session countdown shown at the top of the page. Timestamp-driven, so a
// refresh, tab switch or device sleep never restarts or drifts it.
export function CountdownTimer() {
  const { remainingMs } = useSessionTimer();

  return (
    <section className="border-b border-border bg-surface">
      <div className="container-x py-5 text-center sm:py-6">
        <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-muted sm:text-xs">
          Session ends in
        </p>

        {remainingMs == null ? (
          // Placeholder until the client reads storage — keeps SSR markup stable.
          <p className="mt-2 font-display text-4xl font-extrabold tabular-nums text-ink/20 sm:text-5xl">
            --&nbsp;:&nbsp;--&nbsp;:&nbsp;--
          </p>
        ) : (
          <Digits ms={remainingMs} />
        )}

        <p className="mt-2 text-xs text-muted">Limited session</p>
      </div>
    </section>
  );
}

function Digits({ ms }: { ms: number }) {
  const { hh, mm, ss } = splitTime(ms);
  return (
    <div className="relative mt-2 inline-flex items-center gap-1.5 sm:gap-3">
      {/* Gentle pulse behind the numbers — urgency without flashing. */}
      <span
        aria-hidden
        className="absolute -inset-x-4 -inset-y-2 animate-pulse-soft rounded-xl bg-accent/20"
      />
      <Cell value={hh} />
      <Sep />
      <Cell value={mm} />
      <Sep />
      <Cell value={ss} />
    </div>
  );
}

function Cell({ value }: { value: string }) {
  return (
    <span
      // key on the value so each change re-triggers the tick animation
      key={value}
      className="relative animate-tick font-display text-4xl font-extrabold tabular-nums text-ink sm:text-5xl"
    >
      {value}
    </span>
  );
}

function Sep() {
  return (
    <span className="relative font-display text-3xl font-bold text-accent2 sm:text-4xl">:</span>
  );
}
