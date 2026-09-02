"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Full-screen hero with background video (webm + mobile mp4) falling back
 * to the first pool photo. Kept as a client component only for the
 * video/scroll niceties — everything above the fold is still instant.
 */
export function HomeHero(props: {
  locale: Locale;
  tagline: string;
  location: string;
  cta: string;
  discover: string;
  fallbackImage: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = v.play();
    if (play) play.catch(() => setVideoOk(false));
  }, []);

  return (
    <section className="relative flex h-[100svh] min-h-[560px] items-end justify-center overflow-hidden">
      {videoOk ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={props.fallbackImage}
          aria-hidden
        >
          <source src="/media/video/hero.webm" type="video/webm" />
          <source src="/media/video/hero-mobile.mp4" type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.fallbackImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/65" />

      <div className="relative z-10 mb-24 px-5 text-center text-white">
        <p className="mb-5 text-[0.6rem] font-medium uppercase tracking-[0.22em] text-gold sm:text-[0.7rem] sm:tracking-[0.5em]">
          {props.location}
        </p>
        <h1 className="font-display text-5xl leading-[1.05] tracking-wide sm:text-6xl md:text-7xl">
          ONLY&nbsp;VIEW
        </h1>
        <p className="mx-auto mt-5 max-w-md font-display text-xl italic text-white/85 md:text-2xl">
          {props.tagline}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link href={localePath(props.locale, "/booking")} className="btn-gold">
            {props.cta}
          </Link>
          <a href="#intro" className="btn-outline-light">
            {props.discover}
          </a>
        </div>
      </div>

      <a
        href="#intro"
        aria-label={props.discover}
        className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-white/70 transition hover:text-gold"
      >
        <svg width="22" height="34" viewBox="0 0 22 34" fill="none" aria-hidden>
          <rect x="1" y="1" width="20" height="32" rx="10" stroke="currentColor" />
          <circle cx="11" cy="10" r="3" fill="currentColor">
            <animate attributeName="cy" values="10;22;10" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      </a>
    </section>
  );
}
