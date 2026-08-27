import { Navbar } from "@/components/Navbar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Footer } from "@/components/Footer";
import { SearchExperience } from "@/components/SearchExperience";
import { Faq } from "@/components/Faq";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "FF ID Recovery";

const trust = [
  { title: "Server-verified", body: "Every payment is verified on our server before a request is submitted." },
  { title: "Encrypted & private", body: "We only store your Free Fire ID and request status — nothing else." },
  { title: "Transparent status", body: "Track Banned, Pending, and Unbanned states any time you search." },
];

// Background image with a soft white overlay so foreground text stays readable.
function bgStyle(url?: string, overlay = "rgba(255,255,255,0.82)") {
  if (!url) return undefined;
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export default async function HomePage() {
  const s = await getSettings();

  return (
    <div style={bgStyle(s.img_page_bg, "rgba(255,255,255,0.9)")}>
      <CountdownTimer />
      <Navbar />
      <main>
        {/* Top banner */}
        {s.img_banner_top && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.img_banner_top} alt="" className="h-auto w-full object-cover" />
        )}

        {/* Hero */}
        <section className="relative overflow-hidden" style={bgStyle(s.img_hero_bg)}>
          <div className="container-x py-16 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-ink">
                Free Fire Account Recovery
              </span>
              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.3] text-ink sm:text-6xl">
                Check your ban status &{" "}
                <span className="box-decoration-clone rounded-md bg-accent px-2 leading-relaxed text-ink">
                  recover your ID
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
                {siteName} lets you instantly look up whether your Free Fire ID is
                banned, see the reason, and submit a verified unban request.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-2xl">
              <SearchExperience />
              <p className="mt-3 text-center text-xs text-muted">
                Try a demo ID: <code className="text-slate-600">100000001</code>
              </p>
            </div>
          </div>
        </section>

        {/* Middle banner */}
        {s.img_banner_mid && (
          <div className="container-x mt-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.img_banner_mid} alt="" className="h-auto w-full rounded-xl object-cover" />
          </div>
        )}

        {/* Trust / status */}
        <section className="mt-12" style={bgStyle(s.img_section_bg)}>
          <div className="container-x py-8">
            <div className="grid gap-4 sm:grid-cols-3">
              {trust.map((t) => (
                <div key={t.title} className="card p-6">
                  <h3 className="font-display text-lg font-bold">{t.title}</h3>
                  <p className="mt-2 text-sm text-muted">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20" style={bgStyle(s.img_faq_bg)}>
          <div className="container-x py-8">
            <Faq />
          </div>
        </section>
      </main>
      <Footer bgImage={s.img_footer_bg} />
    </div>
  );
}
