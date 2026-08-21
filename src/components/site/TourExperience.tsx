"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SitePhoto } from "@/lib/photos";
import { localePath, type Locale } from "@/lib/i18n";

export interface TourStop {
  key: string;
  title: string;
  text: string;
  photos: SitePhoto[];
}

/**
 * Scroll-driven room-by-room tour: sticky imagery with a progress rail;
 * each stop swaps the visual as its text block crosses the viewport.
 */
export function TourExperience({
  stops,
  locale,
  bookCta,
}: {
  stops: TourStop[];
  locale: Locale;
  bookCta: string;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = refs.current.indexOf(e.target as HTMLDivElement);
            if (idx >= 0) setActive(idx);
          }
        }
      },
      { rootMargin: "-42% 0px -42% 0px" }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [stops.length]);

  const current = stops[active];

  return (
    <div className="relative lg:grid lg:grid-cols-2">
      {/* Sticky visual (desktop) */}
      <div className="sticky top-0 hidden h-screen items-center justify-center overflow-hidden bg-night lg:flex">
        {stops.map((stop, i) =>
          stop.photos[0] ? (
            <Image
              key={stop.key}
              src={stop.photos[0].url}
              alt={stop.photos[0].alt}
              fill
              sizes="50vw"
              priority={i === 0}
              className={`object-cover transition-opacity duration-700 ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-8">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-gold">
            {String(active + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
          </div>
          <div className="mt-1 font-display text-2xl text-white">{current?.title}</div>
        </div>
        {/* progress rail */}
        <div className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
          {stops.map((s, i) => (
            <button
              key={s.key}
              aria-label={s.title}
              onClick={() =>
                refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className={`h-2 w-2 rounded-full transition ${
                i === active ? "scale-125 bg-gold" : "bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Text flow */}
      <div>
        {stops.map((stop, i) => (
          <div
            key={stop.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="flex min-h-[72vh] flex-col justify-center px-6 py-16 lg:min-h-screen lg:px-16"
          >
            {/* Mobile visual */}
            {stop.photos[0] && (
              <div className="mb-8 overflow-hidden lg:hidden">
                <Image
                  src={stop.photos[0].url}
                  alt={stop.photos[0].alt}
                  width={900}
                  height={640}
                  sizes="100vw"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            )}
            <p className="eyebrow mb-4">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="font-display text-4xl text-ink md:text-5xl">{stop.title}</h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink/70">{stop.text}</p>

            {stop.photos.length > 1 && (
              <div className="mt-8 grid max-w-md grid-cols-3 gap-2">
                {stop.photos.slice(1, 4).map((p) => (
                  <Image
                    key={p.id}
                    src={p.url}
                    alt={p.alt}
                    width={300}
                    height={200}
                    sizes="140px"
                    className="aspect-[3/2] w-full object-cover"
                  />
                ))}
              </div>
            )}

            {i === stops.length - 1 && (
              <Link href={localePath(locale, "/booking")} className="btn-gold mt-10 self-start">
                {bookCta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
