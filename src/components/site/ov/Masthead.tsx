"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { localePath, type Locale } from "@/lib/i18n";
import { dms, fmtHour, sunsetHour } from "@/lib/sun";
import { Magnetic } from "@/components/motion/Magnetic";

/**
 * The home page opening: the villa's own film of the bay, a monumental
 * wordmark low on the left (a landscape with a masthead, not a centred
 * pitch), a single positioning line, and on the right a small glass cluster
 * that leads to the golden-hour chapter with tonight's real sunset time.
 * Everything here is instant HTML; the film and the sunset clock arrive after.
 */
export function Masthead(props: {
  locale: Locale;
  location: string;
  tagline: string;
  cta: string;
  discover: string;
  headingSuffix: string;
  fallbackImage: string;
  sunsetLabel: string;
  sunsetEyebrow: string;
  sunsetText: string;
  sunsetImage?: { url: string; alt: string };
  lat: number;
  lng: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [sunset, setSunset] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const dim = useTransform(scrollYProgress, [0, 0.9], [0, 0.7]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      const play = v.play();
      if (play) play.catch(() => setVideoOk(false));
    }
    // computed in the visitor's browser: today's date, the villa's position
    setSunset(fmtHour(sunsetHour(new Date(), props.lat, props.lng)));
  }, [props.lat, props.lng]);

  const coords = `${dms(props.lat, "lat")} · ${dms(props.lng, "lng")}`;

  return (
    <section
      ref={sectionRef}
      className="relative h-[100svh] min-h-[600px] overflow-hidden bg-night text-white"
      aria-label={props.location}
    >
      <motion.div className="absolute inset-0" style={reduced ? undefined : { scale, y }}>
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
          <img src={props.fallbackImage} alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden />
        )}
      </motion.div>
      {/* a 20% veil for the wordmark, deeper at the foot where the type sits */}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
      <motion.div className="absolute inset-0 bg-night" style={{ opacity: reduced ? 0 : dim }} aria-hidden />

      <motion.div
        className="ov-shell relative z-10 flex h-full flex-col justify-end pb-[calc(6.5rem+env(safe-area-inset-bottom))] xl:pb-10"
        style={reduced ? undefined : { y: textY }}
      >
        {/* the positioning line, mid-height on the left, under a hairline */}
        <div className="rise-in mb-auto mt-[24svh] max-w-[22rem] md:mt-[30svh]" style={{ animationDelay: "0.25s" }}>
          <div className="mb-4 h-px w-16 bg-white/60" />
          <p className="ov-label text-white/75">{props.location}</p>
          <p className="mt-3 font-display text-2xl italic leading-snug text-white/95 md:text-[1.7rem]">
            {props.tagline}
          </p>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="ov-label rise-in mb-2 text-white/60 md:mb-0" style={{ animationDelay: "0.5s" }}>
              {coords}
            </p>
            <h1 className="ov-display text-[clamp(4rem,21vw,15rem)] leading-[0.82] text-white">
              <span className="sr-only">Villa </span>
              {["ONLY", "VIEW"].map((w, i) => (
                <span key={w}>
                  {i > 0 && " "}
                  <span className="split-word">
                    <span className="split-word-inner" style={{ animationDelay: `${0.35 + i * 0.14}s` }}>
                      {w}
                    </span>
                  </span>
                </span>
              ))}
              <span className="sr-only">{props.headingSuffix}</span>
            </h1>
          </div>

          {/* the destination cluster: tonight's sunset, then the two actions */}
          <div className="rise-in w-full shrink-0 space-y-3 xl:w-[27rem]" style={{ animationDelay: "1s" }}>
            {/* on a phone the tile folds to one line: tonight's sunset, a tap away */}
            <a
              href="#golden-hour"
              className="ov-label flex items-center justify-between border-b border-white/20 pb-3 text-white/70 xl:hidden"
            >
              <span>{props.sunsetLabel}</span>
              <span className="flex items-center gap-2 font-mono text-sm tracking-normal text-white" suppressHydrationWarning>
                {sunset ?? "—:—"}
                <ArrowUpRight className="h-4 w-4 text-gold" strokeWidth={1.25} aria-hidden />
              </span>
            </a>
            <a href="#golden-hour" className="ov-glass-tile group hidden h-40 overflow-hidden rounded-lg xl:flex">
              {props.sunsetImage && (
                <div className="ov-photo relative w-40 shrink-0">
                  <Image src={props.sunsetImage.url} alt="" fill sizes="160px" className="object-cover" aria-hidden />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="ov-label text-gold">{props.sunsetEyebrow}</p>
                  <ArrowUpRight className="ov-arrow h-5 w-5 shrink-0 text-white/70" strokeWidth={1.25} aria-hidden />
                </div>
                <p className="text-sm leading-snug text-white/80">{props.sunsetText}</p>
                <p className="flex items-baseline justify-between gap-3">
                  <span className="ov-label text-white/55">{props.sunsetLabel}</span>
                  <span className="font-mono text-lg text-white" suppressHydrationWarning>
                    {sunset ?? "—:—"}
                  </span>
                </p>
              </div>
            </a>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <Magnetic className="flex-1">
                <Link href={localePath(props.locale, "/booking")} className="ov-btn ov-btn-gold w-full">
                  {props.cta}
                </Link>
              </Magnetic>
              <Magnetic className="flex-1">
                <a href="#intro" className="ov-btn ov-btn-glass w-full">
                  {props.discover}
                </a>
              </Magnetic>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
