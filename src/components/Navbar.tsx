import Link from "next/link";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "FF ID Recovery";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/70 backdrop-blur">
      <nav className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-ink">
            FF
          </span>
          <span className="hidden sm:inline">{siteName}</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/#faq" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
            FAQ
          </Link>
          <Link href="/#check" className="btn-primary px-4 py-2 text-sm">
            Check ID Status
          </Link>
        </div>
      </nav>
    </header>
  );
}
