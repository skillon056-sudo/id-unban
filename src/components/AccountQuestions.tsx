"use client";

import { useEffect, useState } from "react";

// A short set of account questions before the deposit step. Fixed, in the same
// order every time — nothing is randomised, so a customer who comes back sees
// exactly what they saw before.
//
// Every answer is accepted: this collects context about the account, it does
// not test anyone, so there is no wrong choice and nobody is turned away.
const QUESTIONS: { id: string; q: string; options: string[] }[] = [
  {
    id: "mode",
    q: "Which mode do you play the most?",
    options: ["Battle Royale", "Clash Squad", "Lone Wolf", "Craftland"],
  },
  {
    id: "rank",
    q: "What was your rank in the last season?",
    options: ["Bronze / Silver", "Gold / Platinum", "Diamond", "Heroic / Grandmaster"],
  },
  {
    id: "age",
    q: "How long have you been playing on this ID?",
    options: ["Under 6 months", "6 months – 1 year", "1 – 2 years", "Over 2 years"],
  },
];

// Answers are remembered per order, so a refresh or a trip to the payment page
// and back doesn't ask again.
const key = (orderId: string) => `ff_acct_q_${orderId}`;

export function AccountQuestions({
  orderId,
  children,
}: {
  orderId: string;
  children: React.ReactNode;
}) {
  const [done, setDone] = useState<boolean | null>(null); // null until storage is read
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setDone(localStorage.getItem(key(orderId)) !== null);
    } catch {
      setDone(false); // storage blocked — just ask
    }
  }, [orderId]);

  const answered = QUESTIONS.every((q) => answers[q.id]);

  function submit() {
    try {
      localStorage.setItem(key(orderId), JSON.stringify(answers));
    } catch {
      /* storage blocked — carrying on is more important than remembering */
    }
    setDone(true);
  }

  // Don't flash the questions before we know whether they were already done.
  if (done === null) return null;
  if (done) return <>{children}</>;

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        A few questions about your account
      </p>
      <p className="mt-1 text-xs text-muted">
        This helps us prepare your appeal with the right details.
      </p>

      <div className="mt-4 space-y-5">
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id}>
            <legend className="text-sm font-semibold text-ink">
              {i + 1}. {q.q}
            </legend>
            <div className="mt-2 grid gap-2">
              {q.options.map((opt) => {
                const picked = answers[q.id] === opt;
                return (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                      picked
                        ? "border-accent bg-accent/10 font-medium text-ink"
                        : "border-border hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={picked}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className="h-4 w-4 accent-accent"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <button onClick={submit} disabled={!answered} className="btn-primary mt-6 w-full">
        Continue
      </button>
      {!answered && (
        <p className="mt-2 text-center text-xs text-muted">
          Answer all three to continue.
        </p>
      )}
    </div>
  );
}
