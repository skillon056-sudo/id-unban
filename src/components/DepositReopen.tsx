"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";

// Shown once the step's countdown has run out. Restarts it on the server and
// reloads, which brings the form back.
export function DepositReopen({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deposit/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not reopen this step.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen this step.");
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={reopen} disabled={busy} className="btn-primary mt-4 w-full">
        {busy ? <Spinner className="h-5 w-5" /> : "I WANT TO PAY NOW"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-700">{error}</p>}
    </>
  );
}
