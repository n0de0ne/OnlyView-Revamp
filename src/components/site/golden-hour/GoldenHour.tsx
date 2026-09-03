"use client";

/**
 * "Golden hour at Pointe Milou": the villa's own photographs of the bay,
 * from afternoon to nightfall, dissolved by the hour. The current frame is
 * a plain image (fast, indexable); the WebGL dissolve loads only when the
 * block nears the viewport and runs only while it is visible.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SitePhoto } from "@/lib/photos";
import type { Frame } from "./GoldenHourScene";

const Scene = dynamic(() => import("./GoldenHourScene"), { ssr: false });

/** the same view, five hours apart — file → the hour it was taken */
const SEQUENCE: Array<[string, number]> = [
  ["pool-terrace/pool-terrace-02.webp", 15.3],
  ["night/night-04.webp", 17.7],
  ["night/night-02.webp", 18.2],
  ["night/night-05.webp", 18.7],
  ["night/night-06.webp", 19.3],
];

export interface GoldenHourLabels {
  eyebrow: string;
  title: string;
  text: string;
  hour: string;
  play: string;
  pause: string;
  moments: Array<[number, string]>;
}

const fmt = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${mm.toString().padStart(2, "0")}`;
};

export function GoldenHour({
  labels,
  photos,
  className = "",
}: {
  labels: GoldenHourLabels;
  photos: SitePhoto[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(17.9);
  const [playing, setPlaying] = useState(true);

  const frames: Array<Frame & { alt: string }> = SEQUENCE.map(([file, h]) => {
    const p = photos.find((x) => x.url.endsWith(file));
    return { url: p?.url ?? `/media/photos/${file}`, alt: p?.alt ?? "", hour: h };
  });
  // the still behind the canvas: the frame the hour is closest to
  const current = frames.reduce((best, f) => (Math.abs(f.hour - hour) < Math.abs(best.hour - hour) ? f : best), frames[0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the evening advances on its own — about a minute of light per second
  useEffect(() => {
    if (!playing || !visible || reduced) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setHour((h) => (h + dt * 0.016 > 19.9 ? 15.2 : h + dt * 0.016));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, reduced]);

  const onPointer = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  };

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden bg-night text-white ${className}`}
      aria-labelledby="golden-hour"
      onPointerMove={onPointer}
      onPointerLeave={() => (pointer.current = { x: 0, y: 0 })}
    >
      <div className="relative h-[78svh] min-h-[480px] w-full">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />
        {near && (
          <Suspense fallback={null}>
            <Scene frames={frames} hour={hour} active={visible && !reduced} pointer={pointer} />
          </Suspense>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night to-transparent" />
      </div>

      <div className="relative mx-auto -mt-28 max-w-7xl px-5 pb-16 lg:px-8">
        <div className="glass-dark p-6 sm:p-8 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10">
          <div>
            <p className="eyebrow mb-3">{labels.eyebrow}</p>
            <h2 id="golden-hour" className="font-display text-3xl leading-tight md:text-4xl">
              {labels.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{labels.text}</p>
          </div>
          <div className="mt-6 w-full lg:mt-0 lg:w-96">
            <div className="flex items-baseline justify-between">
              <label htmlFor="golden-hour-time" className="text-[0.66rem] uppercase tracking-[0.2em] text-white/60">
                {labels.hour}
              </label>
              <motion.span key={fmt(hour)} className="font-display text-3xl text-gold" initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}>
                {fmt(hour)}
              </motion.span>
            </div>
            <input
              id="golden-hour-time"
              type="range"
              min={15.2}
              max={19.9}
              step={0.05}
              value={hour}
              onChange={(e) => {
                setPlaying(false);
                setHour(parseFloat(e.target.value));
              }}
              className="golden-range mt-2 w-full"
              aria-valuetext={fmt(hour)}
            />
            <div className="mt-2 flex items-center justify-between gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
              {labels.moments.map(([h, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setHour(h);
                  }}
                  className={`tap whitespace-nowrap transition hover:text-gold ${Math.abs(hour - h) < 0.25 ? "text-gold" : ""}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="tap ml-1 border border-white/25 px-2 py-1 text-white/80 transition hover:border-gold hover:text-gold"
                aria-pressed={playing}
              >
                {playing ? labels.pause : labels.play}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
