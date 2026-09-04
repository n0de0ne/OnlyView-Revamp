"use client";

/**
 * "Golden hour at Pointe Milou": the villa's own photograph of the bay from
 * the pool, brought to life in WebGL — the sea, the pool, the clouds and the
 * light move, the hour sinks the sun and brings the night. The still is a
 * plain image (fast, indexable); the scene loads only when the block nears
 * the viewport and renders only while it is visible.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SitePhoto } from "@/lib/photos";
import type { SceneControls } from "./GoldenHourScene";

const Scene = dynamic(() => import("./GoldenHourScene"), { ssr: false });

const PHOTO = "night/night-01.webp";
const MASK = "/media/golden/mask-night-01.png";
const START = 17.3;
const END = 19.5;

export interface GoldenHourLabels {
  eyebrow: string;
  title: string;
  text: string;
  hint: string;
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
  const stage = useRef<HTMLDivElement>(null);
  const controls = useRef<SceneControls>({ pointer: { x: 0, y: 0 }, taps: [] });
  const reduced = useReducedMotion();
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(17.6);
  const [dim, setDim] = useState(0);
  const [playing, setPlaying] = useState(true);
  // once the scene has drawn, the still under it is hidden: nothing can show through
  const [live, setLive] = useState(false);

  const photo = photos.find((p) => p.url.endsWith(PHOTO));
  const src = photo?.url ?? `/media/photos/${PHOTO}`;

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

  // the evening advances on its own, and fades back to golden hour at the end
  useEffect(() => {
    if (!playing || !visible || reduced) return;
    let raf = 0;
    let last = performance.now();
    let fading = false;
    let fade = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (fading) {
        fade += dt * 1.6;
        if (fade >= 1) {
          setHour(START);
          fading = false;
          fade = 0;
          setDim(0);
        } else {
          setDim(fade < 0.5 ? fade * 2 : 0);
          if (fade >= 0.5) setHour(START);
        }
      } else {
        setHour((h) => {
          const n = h + dt * 0.014;
          if (n >= END) {
            fading = true;
            return END;
          }
          return n;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, reduced]);

  const onPointer = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    controls.current.pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  };

  const onTouch = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    controls.current.taps.push({ x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height });
  };

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden bg-night text-white ${className}`}
      aria-labelledby="golden-hour"
      onPointerMove={onPointer}
      onPointerLeave={() => (controls.current.pointer = { x: 0, y: 0 })}
    >
      <div ref={stage} className="relative h-[84svh] min-h-[520px] w-full cursor-crosshair" onPointerDown={onTouch}>
        {/* the still under the scene, cropped the same way (anchor 42% from the left and the bottom) */}
        <Image
          src={src}
          alt={photo?.alt ?? ""}
          fill
          sizes="100vw"
          className="object-cover object-[42%_58%]"
          style={{ visibility: live ? "hidden" : "visible" }}
          priority={false}
        />
        {near && (
          <Suspense fallback={null}>
            <Scene
              photo={src}
              mask={MASK}
              hour={hour}
              dim={dim}
              active={visible && !reduced}
              controls={controls}
              onReady={() => setLive(true)}
            />
          </Suspense>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night to-transparent" />
        <p className="pointer-events-none absolute right-5 top-24 text-[0.62rem] uppercase tracking-[0.2em] text-white/60 lg:right-8">
          {labels.hint}
        </p>
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
              min={START}
              max={END}
              step={0.01}
              value={hour}
              onChange={(e) => {
                setPlaying(false);
                setDim(0);
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
                    setDim(0);
                    setHour(h);
                  }}
                  className={`tap whitespace-nowrap transition hover:text-gold ${Math.abs(hour - h) < 0.18 ? "text-gold" : ""}`}
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
