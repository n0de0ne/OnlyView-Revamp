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
    <section className="bg-sea py-16 lg:py-24">
      <div className="ov-shell">
        <div className="mb-10 grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="ov-label text-white/55">
              <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
              {label}
            </p>
            <h2 className="ov-h2 mt-4 text-white">{title}</h2>
          </div>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-white/70 lg:col-span-4 lg:col-start-9">
            {text}
          </p>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-[16/10]">
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
                    className="glass flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-ink transition group-hover:scale-105"
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
                  <span className="ov-btn ov-btn-glass">
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
