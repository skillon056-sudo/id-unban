"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { ID_STATUSES } from "@/lib/types";

export interface IdRecord {
  id?: string;
  gameId: string;
  status: string;
  banReason?: string | null;
  unbanEnabled: boolean;
  price?: number | null;
  notes?: string | null;
}

export function IdForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: IdRecord;
  onSaved: (rec: IdRecord) => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState<IdRecord>(
    initial ?? { gameId: "", status: "BANNED", banReason: "", unbanEnabled: true, notes: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof IdRecord>(key: K, value: IdRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const url = editing ? `/api/admin/ids/${initial!.id}` : "/api/admin/ids";
    const method = editing ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: form.gameId,
          status: form.status,
          banReason: form.banReason || null,
          unbanEnabled: form.unbanEnabled,
          price: form.price ? Number(form.price) : null,
          notes: form.notes || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Save failed.");
        setBusy(false);
        return;
      }
      onSaved(body);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="f-gameId">Free Fire ID</label>
        <input
          id="f-gameId"
          inputMode="numeric"
          required
          className="input"
          value={form.gameId}
          onChange={(e) => set("gameId", e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="f-status">Status</label>
          <select
            id="f-status"
            className="input"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {ID_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 pb-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-border bg-bg accent-accent"
              checked={form.unbanEnabled}
              onChange={(e) => set("unbanEnabled", e.target.checked)}
            />
            Unban available
          </label>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="f-price">Unban price (₹)</label>
        <input
          id="f-price"
          inputMode="numeric"
          className="input"
          placeholder="Leave empty to use the global price"
          value={form.price ?? ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            set("price", digits ? Number(digits) : null);
          }}
        />
        <p className="mt-1 text-xs text-muted">This exact amount opens in the payment gateway for this ID.</p>
      </div>

      <div>
        <label className="label" htmlFor="f-reason">Ban reason</label>
        <input
          id="f-reason"
          className="input"
          placeholder="e.g. Suspicious activity"
          value={form.banReason ?? ""}
          onChange={(e) => set("banReason", e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="f-notes">Notes (internal)</label>
        <textarea
          id="f-notes"
          rows={2}
          className="input"
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? <Spinner className="h-5 w-5" /> : editing ? "Save changes" : "Create ID"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        )}
      </div>
    </form>
  );
}
