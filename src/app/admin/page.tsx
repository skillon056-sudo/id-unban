"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";

interface Stats {
  totalIds: number;
  bannedIds: number;
  unbannedIds: number;
  pendingIds: number;
  totalRequests: number;
  successfulPayments: number;
}

const cards: { key: keyof Stats; label: string; tint: string }[] = [
  { key: "totalIds", label: "Total IDs", tint: "from-sky-500/20 to-sky-500/5" },
  { key: "bannedIds", label: "Banned", tint: "from-red-500/20 to-red-500/5" },
  { key: "unbannedIds", label: "Unbanned", tint: "from-emerald-500/20 to-emerald-500/5" },
  { key: "pendingIds", label: "Pending", tint: "from-amber-500/20 to-amber-500/5" },
  { key: "totalRequests", label: "Unban Requests", tint: "from-violet-500/20 to-violet-500/5" },
  { key: "successfulPayments", label: "Successful Payments", tint: "from-cyan-500/20 to-cyan-500/5" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setStats(b) : setError(b.error || "Failed to load.")))
      .catch(() => setError("Failed to load statistics."));
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Overview of IDs, requests and payments.</p>

      {error && <p className="mt-6 text-red-600">{error}</p>}

      {!stats && !error ? (
        <div className="mt-10 flex justify-center"><Spinner className="h-7 w-7 text-accent" /></div>
      ) : stats ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <div key={c.key} className={`card bg-gradient-to-br p-6 ${c.tint}`}>
              <p className="text-sm text-muted">{c.label}</p>
              <p className="mt-2 font-display text-3xl font-extrabold">{stats[c.key]}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/ids/new" className="btn-primary">Add ID</Link>
        <Link href="/admin/unban-requests" className="btn-ghost">View unban requests</Link>
      </div>
    </div>
  );
}
