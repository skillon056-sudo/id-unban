"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/utils";

interface Payout {
  id: string;
  payoutId: string;
  amount: number;
  method: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  status: string;
  gatewayStatus: string | null;
  utr: string | null;
  error: string | null;
  createdAt: string;
}

// Same shapes the server validates with — keep the two in step.
const UPI_RE = /^[a-z0-9._-]{2,64}@[a-z]{2,32}$/;
const IFSC_RE = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

export default function WithdrawPage() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [configured, setConfigured] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [bal, setBal] = useState<{
    collectedNet: number;
    gatewayFees: number;
    paidOut: number;
    available: number;
    payments: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [plan, setPlan] = useState<number[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await fetch("/api/admin/payouts").then((r) => r.json());
      setRows(b.items ?? []);
      setConfigured(b.configured !== false);
      setTotalSent(b.totalSent ?? 0);
      const bl = await fetch("/api/admin/balance").then((r) => r.json());
      if (bl?.available != null) setBal(bl);
    } catch {
      /* the list is not critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const amountNum = Math.round(Number(amount || 0));
  const destinationOk =
    method === "upi"
      ? UPI_RE.test(account.trim().toLowerCase())
      : /^\d{6,20}$/.test(account.trim()) && IFSC_RE.test(ifsc.trim());
  const ready = name.trim().length > 1 && destinationOk && amountNum > 0 && !busy;

  async function send(confirmDuplicate = false) {
    if (!ready) return;
    // Money leaving is worth one deliberate confirmation.
    if (
      !confirm(
        `Send ₹${amountNum.toLocaleString()} to ${account.trim()}?\n\nThis moves real money and cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          beneficiaryName: name.trim(),
          note: note.trim() || undefined,
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
          ...(method === "upi"
            ? { method, beneficiaryAccount: account.trim().toLowerCase() }
            : {
                method,
                beneficiaryAccount: account.trim(),
                ifsc: ifsc.trim().toUpperCase(),
                bankName: bankName.trim() || undefined,
              }),
        }),
      });
      const body = await res.json();
      if (res.status === 409 && body.duplicate) {
        setBusy(false);
        if (confirm(`${body.error}

Send it anyway?`)) return send(true);
        return;
      }
      if (!res.ok) throw new Error(body.error || "Payout failed.");
      setSent(body.payout?.payoutId ?? "sent");
      setName("");
      setAccount("");
      setIfsc("");
      setBankName("");
      setAmount("");
      setNote("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout failed.");
    } finally {
      setBusy(false);
    }
  }

  function destination() {
    return method === "upi"
      ? { method, beneficiaryAccount: account.trim().toLowerCase() }
      : {
          method,
          beneficiaryAccount: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim() || undefined,
        };
  }

  async function preview() {
    setPlanning(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/admin/payouts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          beneficiaryName: name.trim(),
          ...destination(),
          dryRun: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not split that amount.");
      setPlan(body.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not split that amount.");
    } finally {
      setPlanning(false);
    }
  }

  async function sendBulk() {
    if (!plan) return;
    if (
      !confirm(
        `Send ₹${amountNum.toLocaleString()} as ${plan.length} payouts to ${account.trim()}?

` +
          plan.map((c) => `₹${c.toLocaleString()}`).join("  +  ") +
          `

This moves real money and cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch("/api/admin/payouts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          beneficiaryName: name.trim(),
          note: note.trim() || undefined,
          ...destination(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Bulk payout failed.");
      if (body.sent < body.planned) {
        const failed = body.results?.find((r: { ok: boolean }) => !r.ok);
        setError(
          `Sent ${body.sent} of ${body.planned} (₹${body.sentTotal.toLocaleString()} of ₹${body.requestedTotal.toLocaleString()}). Stopped because: ${failed?.error ?? "the gateway refused one"}`,
        );
      } else {
        setSent(`${body.sent} payouts, batch ${body.batchId}`);
      }
      setPlan(null);
      setAmount("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk payout failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(payoutId: string) {
    await fetch(`/api/admin/payouts/${payoutId}`).catch(() => {});
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Withdraw / Refund</h1>
      <p className="mt-1 text-sm text-muted">
        Sends money out through the payment gateway. Nothing here happens on its own —
        every payout is one you send.
      </p>

      {bal && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Available</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-ink">
              &#8377;{bal.available.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">after gateway fees and payouts</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Collected</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              &#8377;{bal.collectedNet.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">
              {bal.payments} payments, &#8377;{bal.gatewayFees.toLocaleString()} in fees
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Paid out</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">
              &#8377;{bal.paidOut.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">including payout fees</p>
          </div>
        </div>
      )}

      {!configured && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Payout credentials are missing, so nothing can be sent yet.
        </div>
      )}

      <div className="card mt-6 max-w-lg p-6">
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {sent && (
          <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
            Sent. Reference <span className="font-mono font-semibold">{sent}</span> — the
            gateway confirms it in the list below.
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["single", "bulk"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setPlan(null);
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === m ? "bg-white shadow-card text-ink" : "text-slate-600"
              }`}
            >
              {m === "single" ? "Single payout" : "Bulk payout"}
            </button>
          ))}
        </div>

        <span className="label">Send to</span>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["upi", "bank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                method === m
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {m === "upi" ? "UPI ID" : "Bank account"}
            </button>
          ))}
        </div>

        <span className="label">Name</span>
        <input
          className="input"
          placeholder="Beneficiary name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <span className="label mt-3">{method === "upi" ? "UPI ID" : "Account number"}</span>
        <input
          className="input"
          placeholder={method === "upi" ? "name@bank" : "Account number"}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />

        {method === "bank" && (
          <>
            <span className="label mt-3">IFSC</span>
            <input
              className="input"
              placeholder="HDFC0001234"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            />
            <span className="label mt-3">Bank name (optional)</span>
            <input
              className="input"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </>
        )}

        <span className="label mt-3">
          {mode === "bulk" ? "Total amount (&#8377;) — split into &#8377;200–&#8377;5,000 payouts, all different" : "Amount (&#8377;)"}
        </span>
        <input
          className="input"
          inputMode="numeric"
          placeholder={mode === "bulk" ? "30000" : "1000"}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^0-9]/g, ""));
            setPlan(null);
          }}
        />

        {mode === "bulk" && plan && (
          <div className="mt-3 rounded-xl border border-border bg-slate-100 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {plan.length} payouts
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {plan.map((c) => `₹${c.toLocaleString()}`).join("  +  ")}
            </p>
            <p className="mt-1 text-xs text-muted">
              Total &#8377;{plan.reduce((a, b) => a + b, 0).toLocaleString()}
            </p>
          </div>
        )}

        <span className="label mt-3">Note (optional, for your own records)</span>
        <input
          className="input"
          placeholder="Deposit refund - order FFMU..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {mode === "single" ? (
          <button onClick={() => send()} disabled={!ready} className="btn-primary mt-5 w-full">
            {busy ? (
              <Spinner className="h-5 w-5" />
            ) : (
              `Send ₹${amountNum ? amountNum.toLocaleString() : "0"}`
            )}
          </button>
        ) : plan ? (
          <div className="mt-5 flex gap-2">
            <button onClick={sendBulk} disabled={busy} className="btn-primary flex-1">
              {busy ? <Spinner className="h-5 w-5" /> : `Send ${plan.length} payouts`}
            </button>
            <button onClick={() => setPlan(null)} disabled={busy} className="btn-ghost">
              Change
            </button>
          </div>
        ) : (
          <button onClick={preview} disabled={!ready || planning} className="btn-primary mt-5 w-full">
            {planning ? <Spinner className="h-5 w-5" /> : "Preview split"}
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Payouts sent</h2>
        <span className="text-sm text-muted">
          Total sent: &#8377;{totalSent.toLocaleString()}
        </span>
      </div>

      <div className="card mt-3 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-10">
            <Spinner className="h-6 w-6 text-accent" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-muted">No payouts yet.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/60 text-muted">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">To</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">UTR</th>
                <th className="p-3 font-medium text-right">Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="p-3 text-muted">{formatDate(r.createdAt)}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.beneficiaryName}</div>
                    <div className="font-mono text-xs text-muted">{r.beneficiaryAccount}</div>
                  </td>
                  <td className="p-3 font-semibold">&#8377;{r.amount.toLocaleString()}</td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        r.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.gatewayStatus && (
                      <div className="mt-1 text-xs text-muted">{r.gatewayStatus}</div>
                    )}
                    {r.error && <div className="mt-1 text-xs text-red-600">{r.error}</div>}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.utr || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="font-mono text-xs text-muted">{r.payoutId}</div>
                    {r.status !== "COMPLETED" && (
                      <button
                        onClick={() => refresh(r.payoutId)}
                        className="text-xs text-accent hover:underline"
                      >
                        Check status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
