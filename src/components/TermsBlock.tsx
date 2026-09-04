"use client";

import { useState } from "react";

// The operator's refund policy, optionally in two languages. The toggle only
// appears when a second version actually exists, so a single-language setup
// looks exactly as it did before.
export function TermsBlock({
  primary,
  alternate,
  support,
}: {
  primary: string;
  alternate: string;
  support: string;
}) {
  const [showAlt, setShowAlt] = useState(false);
  const hasAlt = alternate.trim().length > 0;
  const text = showAlt && hasAlt ? alternate : primary;

  return (
    <div className="mt-5 rounded-xl border border-border bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Deposit &amp; refund terms
        </p>
        {hasAlt && (
          <button
            type="button"
            onClick={() => setShowAlt((v) => !v)}
            title={showAlt ? "Show in Hinglish" : "Show in English"}
            aria-label={showAlt ? "Show in Hinglish" : "Show in English"}
            className="-mr-1 -mt-1 flex shrink-0 items-center gap-1 rounded p-1 text-muted transition hover:bg-slate-200 hover:text-ink"
          >
            {/* Translate glyph — deliberately small, it sits beside a label. */}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M12.9 15l-2.6-2.5.03-.03A17.5 17.5 0 0 0 13.98 6H17V4h-7V2H8v2H1v2h11.2A15.5 15.5 0 0 1 9 10.8 15.6 15.6 0 0 1 6.8 7H4.8a17.6 17.6 0 0 0 2.9 4.4l-4.4 4.4L4.7 17.2 9 12.9l2.7 2.7.2-.6zM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12zm-2.6 7l1.6-4.3L19.1 17h-3.2z" />
            </svg>
            <span className="text-[0.65rem] font-bold uppercase tracking-wide">
              {showAlt ? "Hinglish" : "English"}
            </span>
          </button>
        )}
      </div>

      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">{text}</p>

      {support && (
        <p className="mt-3 text-xs text-muted">
          Questions? Contact <span className="font-semibold text-ink">{support}</span>
        </p>
      )}
    </div>
  );
}
