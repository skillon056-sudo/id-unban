"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/ids", label: "Free Fire IDs" },
  { href: "/admin/ids/new", label: "Add ID" },
  { href: "/admin/unban-requests", label: "Requests" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5 font-display font-extrabold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-ink">
          FF
        </span>
        Admin
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive(n.href, n.exact)
                ? "bg-gradient-to-r from-accent/20 to-accent2/20 text-ink"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border/60 p-3">
        <p className="truncate px-2 pb-2 text-xs text-muted">{email}</p>
        <button onClick={logout} className="btn-ghost w-full py-2 text-sm">
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border/60 bg-surface/80 backdrop-blur lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border/60 bg-surface">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/60 bg-bg/70 px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost px-3 py-2 lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <Link href="/" className="text-sm text-muted hover:text-slate-700">
            ← View site
          </Link>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
