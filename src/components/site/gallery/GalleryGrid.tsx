"use client";

/**
 * The public photo library, laid out like the system Photos app: a pinned
 * row of room filters, edge-to-edge square tiles on a phone (pinch the grid
 * for bigger or smaller tiles), one section per room under "All", each
 * opening on a large tile. Tapping a photo opens the full-screen viewer.
 *
 * Everything here renders on the server — the sections' headings and every
 * <img alt> are what crawlers read. Rooms keep the order the admin gave
 * their photos; `?c=room` opens on a room and `#photo-ID` on a photo.
 */
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SitePhoto } from "@/lib/photos";
import { PhotoViewer, type ViewerI18n } from "./PhotoViewer";

interface Props {
  photos: SitePhoto[];
  categories: string[];
  labels: Record<string, string>;
  allLabel: string;
  initialCategory?: string;
  i18n: ViewerI18n & { photos: string };
}

/** tile columns on a phone, from biggest to smallest tiles (pinch to change) */
const PHONE_COLS = [1, 3, 5] as const;

/** cross-fade/morph a layout change where the browser can (Chrome, Safari 18) */
function transition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

export function GalleryGrid({ photos, categories, labels, allLabel, initialCategory, i18n }: Props) {
  const [cat, setCat] = useState<string>(
    initialCategory && categories.includes(initialCategory) ? initialCategory : "all"
  );
  const [cols, setCols] = useState<(typeof PHONE_COLS)[number]>(3);
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const [open, setOpen] = useState<number | null>(null);
  const [closeSignal, setCloseSignal] = useState(0);
  /** whether opening the viewer added a history entry (so closing goes back) */
  const pushed = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  /** rooms in the site's order, each keeping the admin's photo order */
  const sections = useMemo(() => {
    const known = categories.filter((c) => photos.some((p) => p.category === c));
    const extra = [...new Set(photos.map((p) => p.category))].filter((c) => !categories.includes(c));
    return [...known, ...extra].map((c) => ({ cat: c, photos: photos.filter((p) => p.category === c) }));
  }, [photos, categories]);

  const shown = useMemo(() => (cat === "all" ? sections : sections.filter((s) => s.cat === cat)), [sections, cat]);
  /** the viewer pages through what is on screen, in screen order */
  const visible = useMemo(() => shown.flatMap((s) => s.photos), [shown]);

  const pickCat = (c: string) => {
    if (c === cat) return;
    transition(() => setCat(c));
    const url = new URL(window.location.href);
    if (c === "all") url.searchParams.delete("c");
    else url.searchParams.set("c", c);
    url.hash = "";
    window.history.replaceState(null, "", url);
  };

  /* ── viewer ↔ URL ──────────────────────────────────────────────────── */
  const openAt = (i: number) => {
    setOpen(i);
    window.history.pushState(null, "", `#photo-${visible[i].id}`);
    pushed.current = true;
  };

  const onIndex = useCallback(
    (i: number) => {
      setOpen(i);
      window.history.replaceState(null, "", `#photo-${visible[i].id}`);
    },
    [visible]
  );

  const onClosed = useCallback(() => {
    setOpen(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // browser back (or Android's back gesture) closes the viewer
  useEffect(() => {
    if (open == null) return;
    const onPop = () => {
      pushed.current = false;
      setCloseSignal((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  // a shared link to a photo opens it
  useEffect(() => {
    const m = window.location.hash.match(/^#photo-(\d+)$/);
    if (!m) return;
    const id = Number(m[1]);
    let i = visible.findIndex((p) => p.id === id);
    if (i < 0 && photos.some((p) => p.id === id)) {
      setCat("all");
      i = sections.flatMap((s) => s.photos).findIndex((p) => p.id === id);
    }
    if (i >= 0) setOpen(i);
    // on load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbOf = useCallback((p: SitePhoto, reveal: boolean) => {
    const el = document.getElementById(`photo-${p.id}`);
    if (!el) return null;
    let rect = el.getBoundingClientRect();
    if (reveal && (rect.bottom < 0 || rect.top > window.innerHeight)) {
      el.scrollIntoView({ block: "center" });
      rect = el.getBoundingClientRect();
    }
    return { rect, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
  }, []);

  /* ── pinch the grid for bigger or smaller tiles (phones) ───────────── */
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    let d0 = 0;
    let done = false;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        d0 = dist(e.touches);
        done = false;
      }
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !d0 || done) return;
      const k = dist(e.touches) / d0;
      if (k > 1.25 || k < 0.8) {
        done = true;
        const at = PHONE_COLS.indexOf(colsRef.current);
        const next = PHONE_COLS[Math.max(0, Math.min(PHONE_COLS.length - 1, at + (k > 1 ? -1 : 1)))];
        if (next !== colsRef.current) transition(() => setCols(next));
      }
    };
    const end = () => (d0 = 0);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const phoneCols = { 1: "max-sm:grid-cols-1", 3: "max-sm:grid-cols-3", 5: "max-sm:grid-cols-5" }[cols];
  const tileSizes =
    cols === 1
      ? "(max-width: 640px) 100vw, (max-width: 1024px) 34vw, 420px"
      : `(max-width: 640px) ${Math.ceil(100 / cols) + 1}vw, (max-width: 1024px) 34vw, 420px`;
  const featureSizes = "(max-width: 640px) 67vw, (max-width: 1024px) 67vw, 640px";

  let flat = -1;

  return (
    <div>
      {/* pinned room filters */}
      <div className="sticky top-[calc(max(0.6rem,env(safe-area-inset-top))+3.1rem)] z-30 -mx-5 mb-6 bg-sand/80 py-2.5 backdrop-blur-xl backdrop-saturate-150 xl:top-[4.75rem] lg:-mx-8">
        <div className="scroll-none flex gap-2 overflow-x-auto px-5 lg:px-8" role="group" aria-label={allLabel}>
          {["all", ...sections.map((s) => s.cat)].map((c) => {
            const active = cat === c;
            const count = c === "all" ? photos.length : sections.find((s) => s.cat === c)?.photos.length ?? 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => pickCat(c)}
                aria-pressed={active}
                className={`tap flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem] font-medium transition-colors ${
                  active ? "bg-ink text-white shadow-sm" : "bg-ink/[0.06] text-ink/75 hover:bg-ink/10"
                }`}
              >
                {c === "all" ? allLabel : labels[c] ?? c}
                <span className={`tabular-nums ${active ? "text-white/60" : "text-ink/40"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={gridRef} style={{ touchAction: "pan-y" }}>
        {shown.map((s) => (
          <section key={s.cat} className="mb-10 last:mb-0" aria-labelledby={`room-${s.cat}`}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id={`room-${s.cat}`} className="font-display text-[1.6rem] leading-none text-ink sm:text-3xl">
                {labels[s.cat] ?? s.cat}
              </h2>
              <span className="text-[0.8rem] tabular-nums text-ink/45">
                {s.photos.length} {i18n.photos}
              </span>
            </div>
            <div
              className={`-mx-5 grid grid-flow-dense gap-[2px] sm:mx-0 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4 ${phoneCols}`}
            >
              {s.photos.map((p, j) => {
                flat += 1;
                const i = flat;
                // each room opens on a large tile, like a Photos "day"
                const feature = j === 0 && s.photos.length >= 3 && cols !== 1;
                return (
                  <button
                    key={p.id}
                    id={`photo-${p.id}`}
                    type="button"
                    data-photo
                    onClick={() => openAt(i)}
                    aria-label={p.alt}
                    className={`group relative block overflow-hidden bg-sand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 sm:rounded-lg ${
                      cols === 1 ? "max-sm:aspect-[4/3]" : "aspect-square"
                    } sm:aspect-[4/3] ${feature ? "col-span-2 row-span-2" : ""}`}
                    style={{ viewTransitionName: `ph-${p.id}`, visibility: open != null && visible[open]?.id === p.id ? "hidden" : undefined }}
                  >
                    <Image
                      src={p.url}
                      alt={p.alt}
                      fill
                      sizes={feature ? featureSizes : tileSizes}
                      className="object-cover transition duration-700 ease-out group-hover:scale-[1.04] group-active:scale-[0.98]"
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {open != null && visible[open] && (
        <PhotoViewer
          photos={visible}
          index={open}
          onIndex={onIndex}
          onClosed={onClosed}
          thumbOf={thumbOf}
          thumbSizes={tileSizes}
          labels={labels}
          i18n={i18n}
          closeSignal={closeSignal}
        />
      )}
    </div>
  );
}
