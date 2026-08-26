"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

const filters = ["ALL", "PENDING", "IN_PROGRESS", "FILED", "CLOSED", "REJECTED"] as const;
const CASE_STATES = ["PENDING", "IN_PROGRESS", "FILED", "CLOSED", "REJECTED"] as const;

interface Row {
  id: string;
  gameId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  transactionId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  details: string | null;
  adminNotes: string | null;
  filedAt: string | null;
  createdAt: string;
}

const money = (amount: number) => (amount === 0 ? "Free" : `₹${amount}`);

export default function CasesPage() {
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
      const res = await fetch(`/api/admin/unban-requests?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setRows(body.items);
    } catch {
      setError("Failed to load cases.");
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
      <h1 className="font-display text-2xl font-bold">Appeal Cases</h1>
      <p className="mt-1 text-sm text-muted">
        Paid cases land here. Work each one, then move it to Filed once submitted to Garena.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search ID, reference or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                status === f
                  ? "bg-accent text-ink"
                  : "border border-border text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.replace("_", " ")}
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
          <p className="p-12 text-center text-muted">No cases yet.</p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border/60 text-muted">
              <tr>
                <th className="p-4 font-medium">Free Fire ID</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Case</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4 font-mono">{r.gameId}</td>
                  <td className="p-4 max-w-[180px] truncate text-muted">
                    {r.contactEmail || "—"}
                  </td>
                  <td className="p-4">{money(r.amount)}</td>
                  <td className="p-4">
                    <StatusBadge status={r.paymentStatus} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4 text-muted">{formatDate(r.createdAt)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => setOpen(r)} className="text-accent hover:underline">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <CaseDrawer
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

function CaseDrawer({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/unban-requests/${row.orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
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
        <h2 className="font-display text-xl font-bold">Case {row.orderId}</h2>
        <p className="mt-1 text-sm text-muted">Free Fire ID {row.gameId}</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3 rounded-xl bg-slate-100 p-4 text-sm">
          <Field label="Email" value={row.contactEmail || "—"} />
          <Field label="Phone" value={row.contactPhone || "—"} />
          <Field label="Payment" value={`${row.paymentStatus} · ${money(row.amount)}`} />
          {row.transactionId && <Field label="Transaction" value={row.transactionId} />}
          {row.filedAt && <Field label="Filed at" value={formatDate(row.filedAt)} />}
          {row.details && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Customer details
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.details}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="c-status">Case status</label>
          <select
            id="c-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CASE_STATES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="c-notes">Internal notes</label>
          <textarea
            id="c-notes"
            rows={4}
            className="input"
            placeholder="Appeal reference, what you submitted, follow-up dates…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? <Spinner className="h-5 w-5" /> : "Save case"}
          </button>
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
