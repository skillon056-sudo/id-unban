"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/utils";

const filters = ["ALL", "PENDING", "SUBMITTED", "REJECTED"] as const;

interface Row {
  id: string;
  gameId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  transactionId: string | null;
  createdAt: string;
}

export default function UnbanRequestsPage() {
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError("Failed to load requests.");
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
      <h1 className="font-display text-2xl font-bold">Unban Requests</h1>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search by ID or order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                status === f ? "bg-accent text-ink" : "border border-border text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-5 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12"><Spinner className="h-7 w-7 text-accent" /></div>
        ) : error ? (
          <p className="p-8 text-center text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-muted">No unban requests yet.</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border/60 text-muted">
              <tr>
                <th className="p-4 font-medium">Free Fire ID</th>
                <th className="p-4 font-medium">Order ID</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Request</th>
                <th className="p-4 font-medium">Txn ID</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4 font-mono">{r.gameId}</td>
                  <td className="p-4 font-mono text-xs">{r.orderId}</td>
                  <td className="p-4">{formatMoney(r.amount, r.currency)}</td>
                  <td className="p-4"><StatusBadge status={r.paymentStatus} /></td>
                  <td className="p-4"><StatusBadge status={r.status} /></td>
                  <td className="p-4 font-mono text-xs text-muted">{r.transactionId || "—"}</td>
                  <td className="p-4 text-muted">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
