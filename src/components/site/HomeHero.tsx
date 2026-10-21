"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { localePath, type Locale } from "@/lib/i18n";
import { Magnetic } from "@/components/motion/Magnetic";

/**
 * Full-screen hero with background video (webm + mobile mp4) falling back
 * to the first pool photo. The picture recedes and dims as you scroll past
 * it, the words rise one by one on load, the buttons lean toward the
 * pointer — everything above the fold is still instant HTML.
 */
export function HomeHero(props: {
  locale: Locale;
  tagline: string;
  location: string;
  cta: string;
  discover: string;
  /** " — luxury villa rental in Pointe Milou, St Barth" */
  headingSuffix: string;
  fallbackImage: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const dim = useTransform(scrollYProgress, [0, 0.9], [0, 0.75]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = v.play();
    if (play) play.catch(() => setVideoOk(false));
  }, []);

  const words = ["ONLY", "VIEW"];

  return (
    <section ref={sectionRef} className="relative flex h-[100svh] min-h-[560px] items-end justify-center overflow-hidden">
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
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/65" />
      <motion.div className="absolute inset-0 bg-night" style={{ opacity: reduced ? 0 : dim }} aria-hidden />

      <motion.div
        className="relative z-10 mb-24 px-5 text-center text-white"
        style={reduced ? undefined : { y: textY, opacity: textOpacity }}
      >
        <p
          className="rise-in mb-5 text-[0.72rem] font-medium uppercase tracking-[0.2em] text-gold sm:text-[0.7rem] sm:tracking-[0.5em]"
          style={{ animationDelay: "0.2s" }}
        >
          {props.location}
        </p>
        <h1 className="font-display text-5xl leading-[1.05] tracking-wide sm:text-6xl md:text-7xl">
          <span className="sr-only">Villa </span>
          {words.map((w, i) => (
            <span key={w}>
              {i > 0 && " "}
              <span className="split-word">
                <span className="split-word-inner" style={{ animationDelay: `${0.35 + i * 0.14}s` }}>
                  {w}
                </span>
              </span>
            </span>
          ))}
          {/* the rest of the heading is for engines and screen readers — the
              wordmark alone says nothing about what or where this is */}
          <span className="sr-only">{props.headingSuffix}</span>
        </h1>
        <p
          className="rise-in mx-auto mt-5 max-w-md font-display text-xl italic text-white/85 md:text-2xl"
          style={{ animationDelay: "0.8s" }}
        >
          {props.tagline}
        </p>
        <div className="rise-in mt-9 flex flex-wrap justify-center gap-4" style={{ animationDelay: "1s" }}>
          <Magnetic>
            <Link href={localePath(props.locale, "/booking")} className="btn-gold">
              {props.cta}
            </Link>
          </Magnetic>
          <Magnetic>
            <a href="#intro" className="btn-outline-light">
              {props.discover}
            </a>
          </Magnetic>
        </div>
      </motion.div>

      <a
        href="#intro"
        aria-label={props.discover}
        // the tab bar sits there on phones and tablets — the cue is desktop-only
        className="rise-in absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 p-3 text-white/70 transition hover:text-gold xl:block"
        style={{ animationDelay: "1.4s" }}
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
