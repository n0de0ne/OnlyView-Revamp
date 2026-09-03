"use client";

/**
 * "Golden hour at Pointe Milou": the WebGL sky-and-sea scene with an hour
 * control. The scene loads only when the block nears the viewport and runs
 * only while visible; a still gradient and the caption stand in before
 * that, so the section reads and looks right without WebGL at all.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const Scene = dynamic(() => import("./GoldenHourScene"), { ssr: false });

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

export function GoldenHour({ labels, className = "" }: { labels: GoldenHourLabels; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(17.9);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the day advances on its own: about a minute of sky every second
  useEffect(() => {
    if (!playing || !visible || reduced) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setHour((h) => (h + dt * 0.02 > 20 ? 15 : h + dt * 0.02));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, reduced]);

  const t = Math.min(1, Math.max(0, (hour - 15) / 5));
  // the CSS stand-in follows the hour too, so the block is never blank
  const fallback = `linear-gradient(180deg, hsl(${210 - t * 200} ${45 - t * 20}% ${62 - t * 55}%) 0%, hsl(${35 - t * 20} ${80 - t * 60}% ${70 - t * 60}%) 55%, hsl(200 40% ${22 - t * 15}%) 56%, hsl(205 45% ${14 - t * 8}%) 100%)`;

  return (
    <section ref={ref} className={`relative overflow-hidden bg-night text-white ${className}`} aria-labelledby="golden-hour">
      <div className="relative h-[70svh] min-h-[460px] w-full" style={{ background: fallback }}>
        {near && <Scene hour={hour} active={visible && !reduced} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" />
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
          <div className="mt-6 w-full lg:mt-0 lg:w-80">
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
              min={15}
              max={20}
              step={0.05}
              value={hour}
              onChange={(e) => {
                setPlaying(false);
                setHour(parseFloat(e.target.value));
              }}
              className="golden-range mt-2 w-full"
              aria-valuetext={fmt(hour)}
            />
            <div className="mt-2 flex items-center justify-between text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
              {labels.moments.map(([h, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setHour(h);
                  }}
                  className={`tap transition hover:text-gold ${Math.abs(hour - h) < 0.3 ? "text-gold" : ""}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="tap ml-2 border border-white/25 px-2 py-1 text-white/80 transition hover:border-gold hover:text-gold"
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
