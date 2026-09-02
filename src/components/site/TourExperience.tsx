"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SitePhoto } from "@/lib/photos";
import { localePath, type Locale } from "@/lib/i18n";

export interface TourStop {
  key: string;
  title: string;
  text: string;
  photos: SitePhoto[];
}

/** Frame the photo in its own aspect ratio so nothing is ever cropped. */
const ratio = (p: SitePhoto) =>
  p.width && p.height ? `${p.width} / ${p.height}` : "4 / 3";

/**
 * Scroll-driven room-by-room tour: the visual sticks while the text flows,
 * each stop swapping the image as its block crosses the viewport. Photos are
 * shown whole (letterboxed on the dark ground rather than cropped) and every
 * shot of a room can be brought up from the thumbnail strip.
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
  /** selected photo per stop */
  const [picked, setPicked] = useState<Record<number, number>>({});
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

  const photoOf = useCallback(
    (i: number) => stops[i]?.photos[picked[i] ?? 0] ?? stops[i]?.photos[0],
    [stops, picked]
  );
  const current = stops[active];
  const currentPhoto = photoOf(active);

  return (
    <div className="relative lg:grid lg:grid-cols-2">
      {/* Sticky visual (desktop) */}
      <div className="sticky top-0 hidden h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-night px-8 py-10 lg:flex">
        <div
          className="relative w-full max-w-[44rem] overflow-hidden rounded-sm bg-black/40 shadow-2xl"
          style={{ aspectRatio: currentPhoto ? ratio(currentPhoto) : "4 / 3", maxHeight: "72vh" }}
        >
          {stops.map((stop, i) => {
            const p = photoOf(i);
            return p ? (
              <Image
                key={`${stop.key}-${p.id}`}
                src={p.url}
                alt={p.alt}
                fill
                sizes="(min-width: 1024px) min(44rem, 48vw), 100vw"
                priority={i === 0}
                quality={90}
                className={`object-contain transition-opacity duration-700 ${
                  i === active ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : null;
          })}
        </div>

        <div className="flex w-full max-w-[44rem] items-end justify-between gap-6">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.3em] text-gold">
              {String(active + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
            </div>
            <div className="mt-1 font-display text-2xl text-white">{current?.title}</div>
          </div>
          {/* progress rail */}
          <div className="flex gap-2.5 pb-1.5">
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
      </div>

      {/* Text flow */}
      <div>
        {stops.map((stop, i) => {
          const shown = picked[i] ?? 0;
          return (
            <div
              key={stop.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="flex min-h-[72vh] flex-col justify-center px-6 py-16 lg:min-h-screen lg:px-16"
            >
              {/* Mobile visual */}
              {stop.photos[shown] && (
                <div
                  className="relative mb-8 w-full overflow-hidden bg-night lg:hidden"
                  style={{ aspectRatio: ratio(stop.photos[shown]) }}
                >
                  <Image
                    src={stop.photos[shown].url}
                    alt={stop.photos[shown].alt}
                    fill
                    sizes="100vw"
                    quality={90}
                    className="object-contain"
                  />
                </div>
              )}
              <p className="eyebrow mb-4">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="font-display text-4xl text-ink md:text-5xl">{stop.title}</h2>
              <p className="mt-5 max-w-md leading-relaxed text-ink/70">{stop.text}</p>

              {stop.photos.length > 1 && (
                <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-xl lg:max-w-none">
                  {stop.photos.slice(0, 6).map((p, pi) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPicked((s) => ({ ...s, [i]: pi }));
                        refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      aria-label={p.alt}
                      aria-current={pi === shown}
                      className={`relative aspect-[4/3] overflow-hidden transition ${
                        pi === shown
                          ? "ring-2 ring-gold ring-offset-2 ring-offset-sand"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={p.url}
                        alt={p.alt}
                        fill
                        sizes="(min-width: 1024px) 15vw, 30vw"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {i === stops.length - 1 && (
                <Link href={localePath(locale, "/booking")} className="btn-gold mt-10 self-start">
                  {bookCta}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
