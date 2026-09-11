"use client";

import Link from "next/link";
import { useSite } from "@/lib/site-context";

// Kept out of the editable text so it can never go stale: the year comes from
// the clock and the site name from branding.
const FALLBACK_NOTE =
  "Independent support service. Not affiliated with or endorsed by Garena or Free Fire.";

export function Footer({ bgImage }: { bgImage?: string }) {
  const { siteName, footerNote } = useSite();

  const style = bgImage
    ? {
        backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url("${bgImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <footer className="mt-24 border-t border-border/60 py-10 text-sm text-muted" style={style}>
      <div className="container-x flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="whitespace-pre-line text-center sm:text-left">
          © {new Date().getFullYear()} {siteName}
          {"\n"}
          {footerNote.trim() || FALLBACK_NOTE}
        </p>
        {/* No admin link: the sign-in page is reachable at /admin/login directly,
            it just isn't advertised to visitors. */}
        <div className="flex shrink-0 gap-4">
          <Link href="/#faq" className="hover:text-slate-700">FAQ</Link>
        </div>
      </div>
    </footer>
  );
}
