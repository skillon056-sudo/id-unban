"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

const filters = ["ALL", "NOT_REQUESTED", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
const STATES = ["NOT_REQUESTED", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;

interface Row {
  id: string;
  orderId: string;
  serviceOrderId: string | null;
  gameId: string;
  amount: number;
  currency: string;
  upiId: string;
  status: string;
  reference: string | null;
  notes: string | null;
  depositStatus: string;
  depositTxn: string | null;
  requestedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export default function RefundsPage() {
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ status, search });
      const res = await fetch(`/api/admin/refunds?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setRows(body.items);
    } catch {
      setError("Failed to load refunds.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Refunds</h1>
      <p className="mt-1 text-sm text-muted">
        Deposits held, and where each refund stands. Send the money from your UPI app,
        then record the reference here.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search order, ID or UPI…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                status === f
                  ? "bg-accent text-ink"
                  : "border border-border text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner className="h-7 w-7 text-accent" />
          </div>
        ) : error ? (
          <p className="p-8 text-center text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-muted">No deposits yet.</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border/60 text-muted">
              <tr>
                <th className="p-4 font-medium">Free Fire ID</th>
                <th className="p-4 font-medium">UPI ID</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Deposit</th>
                <th className="p-4 font-medium">Refund</th>
                <th className="p-4 font-medium">Paid</th>
                <th className="p-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4 font-mono">{r.gameId}</td>
                  <td className="p-4 font-mono text-xs">{r.upiId}</td>
                  <td className="p-4">₹{r.amount}</td>
                  <td className="p-4">
                    <StatusBadge status={r.depositStatus} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4 text-muted">
                    {r.refundedAt ? formatDate(r.refundedAt) : "—"}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => setOpen(r)} className="text-accent hover:underline">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <RefundDrawer
          row={open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RefundDrawer({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [reference, setReference] = useState(row.reference ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/refunds/${row.orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reference, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="card relative z-10 my-8 w-full max-w-lg p-6">
        <h2 className="font-display text-xl font-bold">Refund · ₹{row.amount}</h2>
        <p className="mt-1 text-sm text-muted">Free Fire ID {row.gameId}</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2 rounded-xl bg-slate-100 p-4 text-sm">
          <Line label="Send to UPI" value={row.upiId} />
          <Line label="Deposit order" value={row.orderId} />
          {row.serviceOrderId && <Line label="Service order" value={row.serviceOrderId} />}
          <Line label="Deposit payment" value={row.depositStatus} />
          {row.depositTxn && <Line label="Deposit txn" value={row.depositTxn} />}
          {row.requestedAt && <Line label="Held since" value={formatDate(row.requestedAt)} />}
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="r-status">Refund status</label>
          <select
            id="r-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Mark Completed only after the money has actually left your account.
          </p>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="r-ref">Payout reference / UTR</label>
          <input
            id="r-ref"
            className="input"
            placeholder="UTR from your UPI app"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="r-notes">Internal notes</label>
          <textarea
            id="r-notes"
            rows={3}
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? <Spinner className="h-5 w-5" /> : "Save refund"}
          </button>
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="break-all text-right font-medium text-ink">{value}</span>
    </div>
  );
}
