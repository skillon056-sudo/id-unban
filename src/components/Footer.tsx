import Link from "next/link";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "FF ID Recovery";

export function Footer({ bgImage }: { bgImage?: string }) {
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
        <p>
          © {new Date().getFullYear()} {siteName}. Fan-made support portal. Not
          affiliated with or endorsed by Garena or Free Fire.
        </p>
        <div className="flex gap-4">
          <Link href="/#faq" className="hover:text-slate-700">FAQ</Link>
          <Link href="/admin/login" className="hover:text-slate-700">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
