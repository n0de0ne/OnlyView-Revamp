"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Item {
  id: number;
  name: string;
  country: string | null;
  rating: number;
  message: string;
}

/**
 * Guest proof as a typographic interlude: one quote at a time in a large
 * italic serif, the guest's name in mono underneath, numbered selectors to
 * move between them. It advances on its own (slowly) unless the visitor has
 * picked one or asked for reduced motion. Every quote stays in the HTML.
 */
export function Testimonials(props: { label: string; title: string; cta: string; href: string; items: Item[] }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();
  const n = props.items.length;

  useEffect(() => {
    if (held || reduced || n < 2) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % n), 9000);
    return () => window.clearInterval(id);
  }, [held, reduced, n]);

  return (
    <section className="bg-night py-24 text-white md:py-36" aria-labelledby="guestbook">
      <div className="ov-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="ov-label text-white/55">
              <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
              {props.label}
            </p>
            <h2 id="guestbook" className="ov-h3 mt-4 text-white/80">
              {props.title}
            </h2>
          </div>
          <Link href={props.href} className="ov-btn ov-btn-glass">
            {props.cta}
          </Link>
        </div>

        <div className="relative mt-14 md:mt-20">
          {props.items.map((r, k) => (
            <figure
              key={r.id}
              className={`transition-opacity duration-700 ${k === i ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"}`}
              aria-hidden={k !== i}
            >
              <div className="mb-6 text-lg tracking-[0.3em] text-gold" aria-label={`${r.rating}/5`}>
                {"★".repeat(r.rating)}
                <span className="text-white/20">{"★".repeat(5 - r.rating)}</span>
              </div>
              <blockquote className="max-w-5xl font-display text-[clamp(1.7rem,3.6vw,3.4rem)] italic leading-[1.15] tracking-[-0.01em] text-white/95">
                “{r.message.length > 420 ? r.message.slice(0, 400).replace(/\s+\S*$/, "") + "…" : r.message}”
              </blockquote>
              <figcaption className="ov-label mt-8 text-white/55">
                {r.name}
                {r.country ? ` · ${r.country}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>

        {n > 1 && (
          <div className="mt-12 flex gap-2" role="tablist" aria-label={props.label}>
            {props.items.map((r, k) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={k === i}
                onClick={() => {
                  setI(k);
                  setHeld(true);
                }}
                className={`tap flex h-11 min-w-11 items-center justify-center rounded-full border px-3 font-mono text-xs transition ${
                  k === i ? "border-gold bg-gold text-night" : "border-white/25 text-white/60 hover:border-white/60"
                }`}
              >
                {String(k + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
