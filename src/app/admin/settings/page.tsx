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
          footer_note: settings.footer_note,
          hero_subtitle: settings.hero_subtitle,
          maintenance_mode: settings.maintenance_mode,
          default_status: settings.default_status,
          payment_enabled: settings.payment_enabled,
          unknown_reason: settings.unknown_reason,
          default_unban_left: settings.default_unban_left,
          default_price_usd: settings.default_price_usd,
          result_note: settings.result_note,
          fee_note: settings.fee_note,
          videos_heading: settings.videos_heading,
          video_1_url: settings.video_1_url,
          video_1_title: settings.video_1_title,
          video_1_duration: settings.video_1_duration,
          video_2_url: settings.video_2_url,
          video_2_title: settings.video_2_title,
          video_2_duration: settings.video_2_duration,
          video_3_url: settings.video_3_url,
          video_3_title: settings.video_3_title,
          video_3_duration: settings.video_3_duration,
          deposit_enabled: settings.deposit_enabled,
          deposit_delay_enabled: settings.deposit_delay_enabled,
          deposit_amount: settings.deposit_amount,
          deposit_note: settings.deposit_note,
          deposit_expired_note: settings.deposit_expired_note,
          deposit_timer_minutes: settings.deposit_timer_minutes,
          deposit_terms: settings.deposit_terms,
          deposit_terms_en: settings.deposit_terms_en,
          progress_title: settings.progress_title,
          progress_body: settings.progress_body,
          case_notice: settings.case_notice,
          cta_label: settings.cta_label,
          service_fee: settings.service_fee,
          service_fee_before: settings.service_fee_before,
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
          <Field label="Homepage line under the headline ({site} = website name; empty = built-in text)">
            <textarea
              rows={3}
              className="input"
              placeholder="{site} lets you instantly look up whether your Free Fire ID is banned, see the reason, and submit a verified unban request."
              value={settings.hero_subtitle ?? ""}
              onChange={(e) => set("hero_subtitle", e.target.value)}
            />
          </Field>
          <Field label="Support contact">
            <input className="input" value={settings.support_contact ?? ""} onChange={(e) => set("support_contact", e.target.value)} />
          </Field>
          <Field label="Footer text (under the © line — business name, contact, address; line breaks kept)">
            <textarea
              rows={4}
              className="input"
              placeholder="Independent support service. Not affiliated with or endorsed by Garena or Free Fire."
              value={settings.footer_note ?? ""}
              onChange={(e) => set("footer_note", e.target.value)}
            />
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
            <p className="font-semibold">Support videos (homepage)</p>
            <p className="mt-1 text-xs text-muted">
              Paste a YouTube link — the thumbnail and title are fetched automatically.
              Leave a slot empty to hide that card.
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Section heading">
                <input className="input" placeholder="Support Videos" value={settings.videos_heading ?? ""} onChange={(e) => set("videos_heading", e.target.value)} />
              </Field>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Video 1</p>
                <input className="input mt-2" placeholder="https://youtube.com/watch?v=..." value={settings.video_1_url ?? ""} onChange={(e) => set("video_1_url", e.target.value)} />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Title (blank = auto from YouTube)" value={settings.video_1_title ?? ""} onChange={(e) => set("video_1_title", e.target.value)} />
                  <input className="input" placeholder="Duration e.g. 01:48" value={settings.video_1_duration ?? ""} onChange={(e) => set("video_1_duration", e.target.value)} />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Video 2</p>
                <input className="input mt-2" placeholder="https://youtube.com/watch?v=..." value={settings.video_2_url ?? ""} onChange={(e) => set("video_2_url", e.target.value)} />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Title (blank = auto from YouTube)" value={settings.video_2_title ?? ""} onChange={(e) => set("video_2_title", e.target.value)} />
                  <input className="input" placeholder="Duration e.g. 01:48" value={settings.video_2_duration ?? ""} onChange={(e) => set("video_2_duration", e.target.value)} />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Video 3</p>
                <input className="input mt-2" placeholder="https://youtube.com/watch?v=..." value={settings.video_3_url ?? ""} onChange={(e) => set("video_3_url", e.target.value)} />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Title (blank = auto from YouTube)" value={settings.video_3_title ?? ""} onChange={(e) => set("video_3_title", e.target.value)} />
                  <input className="input" placeholder="Duration e.g. 01:48" value={settings.video_3_duration ?? ""} onChange={(e) => set("video_3_duration", e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-border p-4">
            <p className="font-semibold">Security deposit (step 2)</p>
            <p className="mt-1 text-xs text-muted">
              Shown after a verified service payment. The terms below are what the
              customer reads before paying — write your real refund policy.
            </p>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deposit step">
                  <select className="input" value={settings.deposit_enabled ?? "false"} onChange={(e) => set("deposit_enabled", e.target.value)}>
                    <option value="false">Off</option>
                    <option value="true">On</option>
                  </select>
                </Field>
                <Field label="15-minute wait before deposit page">
                  <select className="input" value={settings.deposit_delay_enabled ?? "true"} onChange={(e) => set("deposit_delay_enabled", e.target.value)}>
                    <option value="true">On — timer, then deposit page</option>
                    <option value="false">Off — deposit page right after payment</option>
                  </select>
                </Field>
                <Field label="Step countdown (minutes; 0 = off)">
                  <input className="input" inputMode="numeric" placeholder="25" value={settings.deposit_timer_minutes ?? ""} onChange={(e) => set("deposit_timer_minutes", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
                <Field label="Deposit amount (₹)">
                  <input className="input" inputMode="numeric" value={settings.deposit_amount ?? ""} onChange={(e) => set("deposit_amount", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
              </div>
              <Field label="Note on the deposit page (shown above the form; empty = nothing)">
                <textarea
                  rows={3}
                  className="input"
                  placeholder="Anything you want the customer to read before paying the deposit."
                  value={settings.deposit_note ?? ""}
                  onChange={(e) => set("deposit_note", e.target.value)}
                />
              </Field>
              <Field label="Note when the countdown has run out (under the “I want to pay now” button)">
                <textarea
                  rows={3}
                  className="input"
                  placeholder="Shown only after the step's timer ends."
                  value={settings.deposit_expired_note ?? ""}
                  onChange={(e) => set("deposit_expired_note", e.target.value)}
                />
              </Field>
              <Field label="Deposit & refund terms — Hinglish (shown by default; required before the step goes live)">
                <textarea
                  rows={7}
                  className="input"
                  placeholder="Why it is required · who qualifies for a refund · how long it takes · how it is sent · any deductions"
                  value={settings.deposit_terms ?? ""}
                  onChange={(e) => set("deposit_terms", e.target.value)}
                />
              </Field>
              <Field label="Case page heading after payment (empty = “We're preparing your appeal”)">
                <input
                  className="input"
                  placeholder="We're preparing your appeal"
                  value={settings.progress_title ?? ""}
                  onChange={(e) => set("progress_title", e.target.value)}
                />
              </Field>
              <Field label="Line under that heading (empty = built-in text)">
                <textarea
                  rows={2}
                  className="input"
                  placeholder="Your case is in our queue. We're putting together your appeal and will file it with Garena support."
                  value={settings.progress_body ?? ""}
                  onChange={(e) => set("progress_body", e.target.value)}
                />
              </Field>
              <Field label="Case page info box (replaces the whole box; empty = the built-in no-guarantee / free Garena appeal text)">
                <textarea
                  rows={4}
                  className="input"
                  placeholder="Garena decides every ban appeal. We prepare and submit your case and chase it up…"
                  value={settings.case_notice ?? ""}
                  onChange={(e) => set("case_notice", e.target.value)}
                />
              </Field>
              <Field label="Deposit & refund terms — English (optional; adds a small translate toggle)">
                <textarea
                  rows={7}
                  className="input"
                  placeholder="The same terms in English. Leave empty and no toggle is shown."
                  value={settings.deposit_terms_en ?? ""}
                  onChange={(e) => set("deposit_terms_en", e.target.value)}
                />
              </Field>
            </div>
          </div>

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
                <Field label="Was price (₹) — struck through, leave empty for no discount">
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 1000"
                    disabled={settings.service_free === "true"}
                    value={settings.service_fee_before ?? ""}
                    onChange={(e) => set("service_fee_before", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </Field>
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
