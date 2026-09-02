"use client";

import Image from "next/image";
import { useState } from "react";
import type { SitePhoto } from "@/lib/photos";

/**
 * Immersive 3D walkthrough (Giraffe360 / Matterport…). The iframe is heavy,
 * so it loads on demand behind a poster — the page stays fast and the embed
 * only runs for visitors who ask for it.
 */
export function Tour3D({
  url,
  poster,
  label,
  title,
  text,
  cta,
}: {
  url: string;
  poster?: SitePhoto;
  label: string;
  title: string;
  text: string;
  cta: string;
}) {
  const [live, setLive] = useState(false);

  return (
    <section className="bg-night px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 text-center">
          <p className="eyebrow">{label}</p>
          <h2 className="mt-3 font-display text-3xl text-white md:text-4xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed text-white/70">
            {text}
          </p>
        </div>

        <div className="glass-dark relative overflow-hidden rounded-[1.75rem] p-1.5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.4rem] bg-black sm:aspect-[16/10]">
            {live ? (
              <iframe
                src={url}
                title={title}
                className="absolute inset-0 h-full w-full"
                allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <button
                type="button"
                onClick={() => setLive(true)}
                className="group absolute inset-0 h-full w-full"
                aria-label={cta}
              >
                {poster && (
                  <Image
                    src={poster.url}
                    alt={poster.alt}
                    fill
                    sizes="(min-width: 1024px) 1100px, 100vw"
                    className="object-cover opacity-70 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-80"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <span
                    className="glass flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-navy transition group-hover:scale-105"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
                      <path
                        d="M9 7.5v9l7.5-4.5L9 7.5Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="rounded-full border border-white/35 bg-white/20 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-black/25 backdrop-blur-md">
                    {cta}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
