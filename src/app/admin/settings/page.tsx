"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { ID_STATUSES } from "@/lib/types";

type Settings = Record<string, string>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setSettings(b) : setError(b.error || "Failed to load.")))
      .catch(() => setError("Failed to load settings."));
  }, []);

  function set(key: string, value: string) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: settings.site_name,
          unban_price: settings.unban_price,
          currency: settings.currency,
          usd_rate: settings.usd_rate,
          support_contact: settings.support_contact,
          maintenance_mode: settings.maintenance_mode,
          default_status: settings.default_status,
          payment_enabled: settings.payment_enabled,
          unknown_reason: settings.unknown_reason,
          default_unban_left: settings.default_unban_left,
          default_price_usd: settings.default_price_usd,
          result_note: settings.result_note,
          fee_note: settings.fee_note,
          cta_label: settings.cta_label,
          service_fee: settings.service_fee,
          service_free: settings.service_free,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSettings(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!settings && !error) {
    return <div className="flex justify-center p-12"><Spinner className="h-7 w-7 text-accent" /></div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Public configuration. Payment gateway secrets live in environment variables, not here.
      </p>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {settings && (
        <form onSubmit={save} className="card mt-6 space-y-4 p-6">
          <Field label="Website name">
            <input className="input" value={settings.site_name ?? ""} onChange={(e) => set("site_name", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unban price">
              <input className="input" inputMode="numeric" value={settings.unban_price ?? ""} onChange={(e) => set("unban_price", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Currency (gateway)">
              <input className="input" value={settings.currency ?? ""} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
          </div>
          <Field label="USD rate (₹ per $1) — used to show prices in $ on the site">
            <input className="input" inputMode="decimal" value={settings.usd_rate ?? ""} onChange={(e) => set("usd_rate", e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="Support contact">
            <input className="input" value={settings.support_contact ?? ""} onChange={(e) => set("support_contact", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default status for new IDs">
              <select className="input" value={settings.default_status ?? "BANNED"} onChange={(e) => set("default_status", e.target.value)}>
                {ID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Payments">
              <select className="input" value={settings.payment_enabled ?? "true"} onChange={(e) => set("payment_enabled", e.target.value)}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
          </div>
          <Field label="Maintenance mode">
            <select className="input" value={settings.maintenance_mode ?? "false"} onChange={(e) => set("maintenance_mode", e.target.value)}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </Field>

          <div className="mt-2 rounded-xl border border-border p-4">
            <p className="font-semibold">Defaults for IDs without a custom record</p>
            <p className="mt-1 text-xs text-muted">
              Every valid ID gets a result. Admin records override these values.
            </p>
            <div className="mt-4 space-y-4">
              <Field label="Assistance category">
                <input className="input" value={settings.unknown_reason ?? ""} onChange={(e) => set("unknown_reason", e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Unbans remaining (default)">
                  <input className="input" inputMode="numeric" value={settings.default_unban_left ?? ""} onChange={(e) => set("default_unban_left", e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label="Request price ($ USD)">
                  <input className="input" inputMode="decimal" value={settings.default_price_usd ?? ""} onChange={(e) => set("default_price_usd", e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
              </div>
              <Field label="Button label (shown on the result card)">
                <input
                  className="input"
                  placeholder="e.g. Get Appeal Help"
                  value={settings.cta_label ?? ""}
                  onChange={(e) => set("cta_label", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service fee (₹)">
                  <input
                    className="input"
                    inputMode="decimal"
                    disabled={settings.service_free === "true"}
                    value={settings.service_fee ?? ""}
                    onChange={(e) => set("service_fee", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </Field>
                <Field label="Free for everyone">
                  <select
                    className="input"
                    value={settings.service_free ?? "false"}
                    onChange={(e) => set("service_free", e.target.value)}
                  >
                    <option value="false">No — charge the fee above</option>
                    <option value="true">Yes — show Free to everyone</option>
                  </select>
                </Field>
              </div>
              <Field label="Fee note (under the button — use {fee} for the amount; empty = default text)">
                <textarea
                  rows={4}
                  className="input"
                  placeholder="{fee} covers preparing your appeal, submitting it to Garena support…"
                  value={settings.fee_note ?? ""}
                  onChange={(e) => set("fee_note", e.target.value)}
                />
              </Field>
              <Field label="Result note (shown under the result — leave empty to hide)">
                <textarea
                  rows={3}
                  className="input"
                  placeholder="e.g. This is an independent assistance service…"
                  value={settings.result_note ?? ""}
                  onChange={(e) => set("result_note", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <Spinner className="h-5 w-5" /> : "Save settings"}
            </button>
            {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
