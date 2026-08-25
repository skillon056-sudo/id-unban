"use client";

// ID-check progress: one circular loader, and a single line at a time that
// slides in, holds, then slides out before the next one appears.

export interface Step {
  label: string;
  ms: number;
  server?: boolean;
}

// ~4.6s total — each line stays readable without dragging.
export const STEPS: Step[] = [
  { label: "Checking account information", ms: 800 },
  { label: "Reading available information", ms: 800 },
  { label: "Checking account status", ms: 900 },
  { label: "Preparing review details", ms: 800 },
  { label: "Calculating request details", ms: 700 },
  { label: "Server", ms: 900, server: true },
];

function IndiaFlag() {
  // Drawn, not an emoji — Windows doesn't render country-flag emoji.
  return (
    <svg viewBox="0 0 30 20" className="h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-black/10" aria-label="India">
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="6.67" width="30" height="6.66" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}

export function CheckingSteps({ step }: { step: number }) {
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const pct = ((step + 1) / STEPS.length) * 100;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="card animate-fade-up p-8">
      <div className="flex flex-col items-center text-center">
        {/* Circular loader with progress ring */}
        <div className="relative h-24 w-24">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-border" />
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-accent transition-[stroke-dashoffset] duration-500 ease-out"
              strokeDasharray={C}
              strokeDashoffset={C - (C * pct) / 100}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-display text-lg font-extrabold">
            {Math.round(pct)}%
          </span>
        </div>

        <p className="mt-5 font-display text-xs font-bold uppercase tracking-[0.2em] text-muted">
          Checking ID
        </p>

        {/* One line at a time — key remounts it so the slide replays */}
        <div className="mt-3 h-7 w-full overflow-hidden">
          <div
            key={step}
            className="flex animate-slide-through items-center justify-center gap-2"
            style={{ animationDuration: `${current.ms}ms` }}
          >
            {current.server && <IndiaFlag />}
            <span className="font-medium text-ink">
              {current.server ? "Server: India" : `${current.label}…`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
