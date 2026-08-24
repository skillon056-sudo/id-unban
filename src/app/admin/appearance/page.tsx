"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { IMAGE_SLOTS } from "@/lib/appearance";

type Settings = Record<string, string>;

export default function AppearancePage() {
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
    setSettings((s) => ({ ...(s ?? {}), [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Settings = {};
      for (const slot of IMAGE_SLOTS) payload[slot.key] = settings[slot.key] ?? "";
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Appearance & Images</h1>
      <p className="mt-1 text-sm text-muted">
        Set the homepage background images. Upload a file or paste an image URL for each slot, then save.
      </p>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {settings && (
        <>
          <div className="mt-6 space-y-4">
            {IMAGE_SLOTS.map((slot) => (
              <ImageSlotRow
                key={slot.key}
                label={slot.label}
                hint={slot.hint}
                value={settings[slot.key] ?? ""}
                onChange={(v) => set(slot.key, v)}
                onError={setError}
              />
            ))}
          </div>

          <div className="sticky bottom-0 mt-6 flex items-center gap-4 border-t border-border bg-bg/90 py-4 backdrop-blur">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? <Spinner className="h-5 w-5" /> : "Save images"}
            </button>
            {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}

function ImageSlotRow({
  label,
  hint,
  value,
  onChange,
  onError,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Upload failed.");
      onChange(body.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">No image</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
        <input
          className="input mt-2"
          placeholder="/uploads/… or https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost px-3 py-2 text-sm" disabled={uploading}>
            {uploading ? <Spinner className="h-4 w-4" /> : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="btn-ghost px-3 py-2 text-sm">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
