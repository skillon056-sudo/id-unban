import type { VideoCard } from "@/lib/youtube";

// Three video cards in the same shape as the reference support page:
// thumbnail, play control with the runtime beside it, title underneath.
export function SupportVideos({
  videos,
  heading,
}: {
  videos: VideoCard[];
  heading: string;
}) {
  if (videos.length === 0) return null;

  return (
    <section className="container-x mt-16">
      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
        {heading}
      </h2>
      {/* The short accent rule under the heading. */}
      <div className="mt-2 flex items-center gap-1">
        <span className="h-1 w-16 bg-accent" />
        <span className="h-1 w-2 -skew-x-[35deg] bg-accent" />
        <span className="h-1 w-2 -skew-x-[35deg] bg-accent/60" />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <div className="relative overflow-hidden rounded-lg border border-border bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnail}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover transition duration-300 group-hover:scale-105"
              />
              {/* Play control + runtime, bottom-left. */}
              <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded bg-black/70 px-2 py-1 backdrop-blur-sm">
                <span className="grid h-5 w-5 place-items-center rounded-sm border border-white/70">
                  <svg viewBox="0 0 10 12" className="h-2.5 w-2.5 fill-white" aria-hidden>
                    <path d="M0 0l10 6-10 6z" />
                  </svg>
                </span>
                {v.duration && (
                  <span className="font-mono text-xs font-semibold tabular-nums text-white">
                    {v.duration}
                  </span>
                )}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-ink group-hover:text-accent2">
              {v.title}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
