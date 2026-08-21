"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SitePhoto } from "@/lib/photos";

interface Props {
  photos: SitePhoto[];
  categories: string[];
  labels: Record<string, string>;
  allLabel: string;
  initialCategory?: string;
  i18n: { close: string; prev: string; next: string; of: string };
}

/**
 * Interactive gallery: category filter, responsive masonry-ish grid and a
 * full-screen lightbox with keyboard + swipe navigation.
 */
export function GalleryGrid({ photos, categories, labels, allLabel, initialCategory, i18n }: Props) {
  const [cat, setCat] = useState<string>(
    initialCategory && categories.includes(initialCategory) ? initialCategory : "all"
  );
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const visible = useMemo(
    () => (cat === "all" ? photos : photos.filter((p) => p.category === cat)),
    [photos, cat]
  );

  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (dir: 1 | -1) =>
      setLightbox((cur) =>
        cur == null ? cur : (cur + dir + visible.length) % visible.length
      ),
    [visible.length]
  );

  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, close, step]);

  return (
    <div>
      {/* Filters */}
      <div className="scroll-thin mb-10 flex gap-2 overflow-x-auto pb-2">
        {["all", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] transition ${
              cat === c
                ? "border-gold bg-gold text-white"
                : "border-ink/15 text-ink/60 hover:border-gold hover:text-gold"
            }`}
          >
            {c === "all" ? allLabel : labels[c] ?? c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>button]:mb-4">
        {visible.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setLightbox(i)}
            className="group relative block w-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-gold"
            aria-label={p.alt}
          >
            <Image
              src={p.url}
              alt={p.alt}
              width={p.width}
              height={p.height}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="w-full transition duration-700 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
            <span className="absolute bottom-3 left-3 rounded-sm bg-black/50 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
              {labels[p.category] ?? p.category}
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox != null && visible[lightbox] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={visible[lightbox].alt}
          onClick={close}
          onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStart.current == null) return;
            const dx = e.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <button
            onClick={close}
            aria-label={i18n.close}
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-gold"
          >
            ✕
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label={i18n.prev}
            className="absolute left-3 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-gold sm:flex"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label={i18n.next}
            className="absolute right-3 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-gold sm:flex"
          >
            ›
          </button>

          <figure
            className="max-h-[92svh] max-w-[94vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={visible[lightbox].url}
              alt={visible[lightbox].alt}
              width={visible[lightbox].width}
              height={visible[lightbox].height}
              sizes="94vw"
              priority
              className="max-h-[84svh] w-auto object-contain"
            />
            <figcaption className="mt-3 flex items-center justify-between text-xs text-white/60">
              <span className="uppercase tracking-[0.2em]">
                {labels[visible[lightbox].category] ?? visible[lightbox].category}
              </span>
              <span>
                {lightbox + 1} {i18n.of} {visible.length}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
