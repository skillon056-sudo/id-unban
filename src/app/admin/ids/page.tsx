"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { IdForm, type IdRecord } from "@/components/admin/IdForm";
import { formatDate } from "@/lib/utils";

const filters = ["ALL", "BANNED", "UNBANNED", "PENDING"] as const;

interface Row extends IdRecord {
  id: string;
  updatedAt: string;
}

export default function IdsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ search, status });
      const res = await fetch(`/api/admin/ids?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setRows(body.items);
    } catch {
      setError("Failed to load IDs.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  async function remove(row: Row) {
    if (!confirm(`Delete Free Fire ID ${row.gameId}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/ids/${row.id}`, { method: "DELETE" });
    if (res.ok) setRows((r) => r.filter((x) => x.id !== row.id));
    else alert("Delete failed.");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Free Fire IDs</h1>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search by Free Fire ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value.replace(/\D/g, ""))}
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
          <p className="p-12 text-center text-muted">No IDs found.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border/60 text-muted">
              <tr>
                <th className="p-4 font-medium">Free Fire ID</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Reason</th>
                <th className="p-4 font-medium">Unban</th>
                <th className="p-4 font-medium">Updated</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4 font-mono">{row.gameId}</td>
                  <td className="p-4"><StatusBadge status={row.status} /></td>
                  <td className="p-4 max-w-[200px] truncate text-muted">{row.banReason || "—"}</td>
                  <td className="p-4">{row.unbanEnabled ? "Yes" : "No"}</td>
                  <td className="p-4 text-muted">{formatDate(row.updatedAt)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => setEditing(row)} className="text-accent hover:underline">Edit</button>
                    <button onClick={() => remove(row)} className="ml-4 text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditing(null)} />
          <div className="card relative z-10 w-full max-w-lg p-6">
            <h2 className="mb-4 font-display text-xl font-bold">Edit ID</h2>
            <IdForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
