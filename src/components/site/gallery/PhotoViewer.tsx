"use client";

/**
 * The full-screen photo viewer, modelled on the system Photos app: the
 * picture grows out of its thumbnail and shrinks back into it, swipes
 * sideways follow the finger, two fingers (or a double tap) zoom in and pan,
 * and a drag down lets go of the photo. A tap hides the chrome; the strip at
 * the bottom scrubs through the set.
 *
 * Gestures run on pointer events with the whole state in one object, so the
 * slide in hand, its zoom and its drag-to-close all compose into a single
 * transform (origin top-left, relative to the photo's fitted rectangle).
 */
import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { SitePhoto } from "@/lib/photos";

/** iOS's sheet curve, the same one the map uses */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = 380;
/** black space between two slides while swiping */
const GAP = 24;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;

type Rect = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

interface View {
  /** track offset while swiping between photos */
  tx: number;
  /** drag-to-close: offset and shrink of the photo in hand */
  dx: number;
  dy: number;
  ds: number;
  /** zoom of the photo in hand */
  zs: number;
  zx: number;
  zy: number;
  /** backdrop opacity */
  bg: number;
  /** animate to this state (vs. follow the finger) */
  anim: boolean;
}

const REST: View = { tx: 0, dx: 0, dy: 0, ds: 1, zs: 1, zx: 0, zy: 0, bg: 1, anim: true };

type Gesture =
  | { kind: "pending"; start: Pt; t: number; pointerType: string }
  | { kind: "swipe"; start: Pt }
  | { kind: "dismiss"; start: Pt }
  | { kind: "pan"; start: Pt; zx: number; zy: number }
  | { kind: "pinch"; d0: number; c0: Pt; s0: number; zx: number; zy: number };

/** the photo's rectangle when it fills the screen without cropping — edge to
 * edge on a phone, clear of the bars and arrows on a larger screen */
function fitRect(p: SitePhoto, W: number, H: number): Rect {
  const [px, pt, pb] = W >= 768 ? [80, 72, 88] : [0, 0, 0];
  const s = Math.min((W - 2 * px) / p.width, (H - pt - pb) / p.height);
  const w = p.width * s;
  const h = p.height * s;
  return { x: (W - w) / 2, y: pt + (H - pt - pb - h) / 2, w, h };
}

/** rubber band past an edge, like a UIScrollView */
function rubber(v: number, min: number, max: number) {
  if (v < min) return min - (min - v) * 0.3;
  if (v > max) return max + (v - max) * 0.3;
  return v;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export interface ViewerI18n {
  close: string;
  prev: string;
  next: string;
  of: string;
  share: string;
  copied: string;
}

interface Props {
  photos: SitePhoto[];
  index: number;
  onIndex: (i: number) => void;
  /** called once the closing animation has finished */
  onClosed: () => void;
  /** the on-screen thumbnail of a photo (the open/close animation's other end) */
  thumbOf: (p: SitePhoto, reveal: boolean) => { rect: DOMRect; radius: number } | null;
  thumbSizes: string;
  labels: Record<string, string>;
  i18n: ViewerI18n;
  /** a request from outside (browser back) to close */
  closeSignal: number;
}

export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClosed,
  thumbOf,
  thumbSizes,
  labels,
  i18n,
  closeSignal,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [view, setView] = useState<View>({ ...REST, bg: 0, anim: false });
  const [chrome, setChrome] = useState(true);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  /** the morph between thumbnail and screen: a transform + crop for the photo in hand */
  const [morph, setMorph] = useState<{ t: string; clip: string } | null>(null);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const samples = useRef<Array<{ t: number; x: number; y: number }>>([]);
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const commit = useRef<{ timer: number; run: () => void } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const { W, H } = size;
  const photo = photos[index];
  const F = W ? fitRect(photo, W, H) : { x: 0, y: 0, w: 0, h: 0 };
  const last = photos.length - 1;

  /* ── size, scroll lock, reduced motion ─────────────────────────────── */
  useLayoutEffect(() => {
    setMounted(true);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const measure = () => setSize({ W: window.innerWidth, H: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      html.style.overflow = prev;
    };
  }, []);

  /** the transform + crop that puts the fitted photo exactly over its thumbnail */
  const thumbMorph = useCallback(
    (reveal: boolean) => {
      const th = thumbOf(photo, reveal);
      if (!th || !W) return null;
      const T = th.rect;
      const s = Math.max(T.width / F.w, T.height / F.h);
      const x = T.left + T.width / 2 - (F.w * s) / 2 - F.x;
      const y = T.top + T.height / 2 - (F.h * s) / 2 - F.y;
      const ix = (F.w - T.width / s) / 2;
      const iy = (F.h - T.height / s) / 2;
      return {
        t: `translate3d(${x}px, ${y}px, 0) scale(${s})`,
        clip: `inset(${iy}px ${ix}px round ${th.radius / s}px)`,
      };
    },
    [thumbOf, photo, W, F.w, F.h, F.x, F.y]
  );

  /* ── open: grow out of the thumbnail ───────────────────────────────── */
  useLayoutEffect(() => {
    if (!W || phase !== "opening") return;
    const m = reduced ? null : thumbMorph(false);
    if (m) setMorph(m);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setMorph(null);
        setView({ ...REST });
        setPhase("open");
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // only once the screen size is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W]);

  /* ── close: shrink back into the thumbnail (scrolled into view) ────── */
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    clearTimeout(tapTimer.current);
    setPhase("closing");
    const m = reduced ? null : thumbMorph(true);
    if (m) setMorph(m);
    setView((v) => ({ ...v, tx: 0, bg: 0, anim: true, ...(m ? {} : { ds: 0.92 }) }));
    window.setTimeout(onClosed, reduced ? 200 : DURATION);
  }, [thumbMorph, onClosed, reduced]);

  useEffect(() => {
    if (closeSignal) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  /* ── paging ────────────────────────────────────────────────────────── */
  const finishCommit = useCallback(() => {
    if (!commit.current) return;
    clearTimeout(commit.current.timer);
    const run = commit.current.run;
    commit.current = null;
    run();
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      finishCommit();
      const target = index + dir;
      if (target < 0 || target > last) {
        setView((v) => ({ ...v, tx: 0, anim: true }));
        return;
      }
      setView((v) => ({ ...v, tx: -dir * (W + GAP), anim: true }));
      const run = () => {
        onIndex(target);
        setView({ ...REST, anim: false });
      };
      commit.current = { run, timer: window.setTimeout(() => finishCommit(), reduced ? 0 : 320) };
    },
    [index, last, W, onIndex, finishCommit, reduced]
  );

  const jump = useCallback(
    (i: number) => {
      finishCommit();
      onIndex(i);
      setView({ ...REST, anim: false });
    },
    [onIndex, finishCommit]
  );

  /* ── zoom helpers ──────────────────────────────────────────────────── */
  /** allowed translate range for a zoom level: pinned to the edges once
   * the photo outgrows the screen, centred while it does not */
  const bounds = useCallback(
    (s: number) => {
      const w = F.w * s;
      const h = F.h * s;
      const bx = w > W ? [W - F.x - w, -F.x] : [(W - w) / 2 - F.x, (W - w) / 2 - F.x];
      const by = h > H ? [H - F.y - h, -F.y] : [(H - h) / 2 - F.y, (H - h) / 2 - F.y];
      return { minX: bx[0], maxX: bx[1], minY: by[0], maxY: by[1] };
    },
    [F.w, F.h, F.x, F.y, W, H]
  );

  /** zoom to `s` keeping the screen point `p` still */
  const zoomAt = useCallback(
    (s: number, p: Pt, from: View, anim: boolean): View => {
      const u = { x: (p.x - F.x - from.zx) / from.zs, y: (p.y - F.y - from.zy) / from.zs };
      let zx = p.x - F.x - u.x * s;
      let zy = p.y - F.y - u.y * s;
      if (anim) {
        const b = bounds(s);
        zx = clamp(zx, b.minX, b.maxX);
        zy = clamp(zy, b.minY, b.maxY);
      }
      return { ...from, zs: s, zx, zy, anim };
    },
    [F.x, F.y, bounds]
  );

  const settle = useCallback(
    (v: View, vx = 0, vy = 0): View => {
      let s = clamp(v.zs, 1, MAX_ZOOM);
      if (s < 1.02) s = 1;
      if (s === 1) return { ...v, zs: 1, zx: 0, zy: 0, anim: true };
      const b = bounds(s);
      // a little momentum after a pan, then pinned to the edges
      return {
        ...v,
        zs: s,
        zx: clamp(v.zx + vx * 160, b.minX, b.maxX),
        zy: clamp(v.zy + vy * 160, b.minY, b.maxY),
        anim: true,
      };
    },
    [bounds]
  );

  /* ── pointer gestures ──────────────────────────────────────────────── */
  const velocity = (now: number) => {
    const s = samples.current;
    // a finger that stopped before lifting throws nothing
    if (s.length < 2 || now - s[s.length - 1].t > 80) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = Math.max(1, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    const v = viewRef.current;
    gesture.current = {
      kind: "pinch",
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      s0: v.zs,
      zx: v.zx,
      zy: v.zy,
    };
    setView({ ...v, tx: 0, dx: 0, dy: 0, ds: 1, bg: 1 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "open" || e.button > 0) return;
    if ((e.target as HTMLElement).closest("[data-chrome]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    finishCommit();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    samples.current = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    if (pointers.current.size === 2) {
      clearTimeout(tapTimer.current);
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;
    // a tap, or the start of a swipe / pan / drag-to-close once it moves
    gesture.current = { kind: "pending", start: { x: e.clientX, y: e.clientY }, t: e.timeStamp, pointerType: e.pointerType };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    samples.current.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (samples.current.length > 5) samples.current.shift();
    const g = gesture.current;
    if (!g) return;
    const v = viewRef.current;

    if (g.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let s = (g.s0 * d) / g.d0;
      if (s < 1) s = 1 - (1 - s) * 0.4;
      if (s > MAX_ZOOM) s = MAX_ZOOM + (s - MAX_ZOOM) * 0.3;
      // the image point under the first midpoint follows the fingers
      const u = { x: (g.c0.x - F.x - g.zx) / g.s0, y: (g.c0.y - F.y - g.zy) / g.s0 };
      setView({ ...v, zs: s, zx: c.x - F.x - u.x * s, zy: c.y - F.y - u.y * s, anim: false });
      return;
    }

    const mx = e.clientX - g.start.x;
    const my = e.clientY - g.start.y;

    if (g.kind === "pending") {
      if (Math.hypot(mx, my) < 8) return;
      clearTimeout(tapTimer.current);
      if (v.zs > 1.01) gesture.current = { kind: "pan", start: g.start, zx: v.zx, zy: v.zy };
      else if (Math.abs(mx) > Math.abs(my)) gesture.current = { kind: "swipe", start: g.start };
      else {
        gesture.current = { kind: "dismiss", start: g.start };
        setChrome(false);
      }
      return onPointerMove(e);
    }
    if (g.kind === "swipe") {
      const atEdge = (index === 0 && mx > 0) || (index === last && mx < 0);
      setView({ ...v, tx: atEdge ? mx * 0.3 : mx, anim: false });
    } else if (g.kind === "dismiss") {
      const k = Math.min(1, Math.abs(my) / H);
      setView({ ...v, dx: mx, dy: my, ds: 1 - k * 0.45, bg: Math.max(0, 1 - k * 1.8), anim: false });
    } else if (g.kind === "pan") {
      const b = bounds(v.zs);
      setView({
        ...v,
        zx: rubber(g.zx + mx, b.minX, b.maxX),
        zy: rubber(g.zy + my, b.minY, b.maxY),
        anim: false,
      });
    }
  };

  const onTap = (p: Pt, t: number, pointerType: string) => {
    const v = viewRef.current;
    const prev = lastTap.current;
    const onPhoto =
      p.x >= F.x + v.zx && p.x <= F.x + v.zx + F.w * v.zs && p.y >= F.y + v.zy && p.y <= F.y + v.zy + F.h * v.zs;
    if (prev && t - prev.t < DOUBLE_TAP_MS && Math.hypot(p.x - prev.p.x, p.y - prev.p.y) < 40) {
      clearTimeout(tapTimer.current);
      lastTap.current = null;
      setView(v.zs > 1.01 ? { ...v, zs: 1, zx: 0, zy: 0, anim: true } : zoomAt(DOUBLE_TAP_ZOOM, p, v, true));
      return;
    }
    lastTap.current = { t, p };
    clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      // a click beside the photo closes it on a desktop; a tap hides the chrome
      if (pointerType === "mouse" && !onPhoto && v.zs <= 1.01) close();
      else setChrome((c) => !c);
    }, DOUBLE_TAP_MS);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const v = viewRef.current;
    if (!g) return;

    if (g.kind === "pinch") {
      if (pointers.current.size === 1) {
        // one finger stays down: carry on as a pan from where it is
        const [p] = [...pointers.current.values()];
        const settled = settle(v);
        setView(settled);
        gesture.current =
          settled.zs > 1 ? { kind: "pan", start: p, zx: settled.zx, zy: settled.zy } : null;
        samples.current = [];
        return;
      }
      if (pointers.current.size === 0) {
        gesture.current = null;
        setView(v.zs > MAX_ZOOM ? zoomAt(MAX_ZOOM, g.c0, v, true) : settle(v));
      }
      return;
    }

    if (pointers.current.size > 0) return;
    gesture.current = null;
    const { vx, vy } = velocity(e.timeStamp);
    const mx = e.clientX - ("start" in g ? g.start.x : 0);
    const my = e.clientY - ("start" in g ? g.start.y : 0);

    if (g.kind === "pending") {
      if (e.type === "pointerup") onTap({ x: e.clientX, y: e.clientY }, e.timeStamp, g.pointerType);
    } else if (g.kind === "swipe") {
      if ((mx < -W * 0.18 || vx < -0.35) && index < last && vx <= 0.2) go(1);
      else if ((mx > W * 0.18 || vx > 0.35) && index > 0 && vx >= -0.2) go(-1);
      else setView({ ...v, tx: 0, anim: true });
    } else if (g.kind === "dismiss") {
      if (Math.abs(my) > 110 || Math.abs(vy) > 0.6) close();
      else {
        setView({ ...v, dx: 0, dy: 0, ds: 1, bg: 1, anim: true });
        setChrome(true);
      }
    } else if (g.kind === "pan") {
      setView(settle(v, vx, vy));
    }
  };

  /* ── keyboard, trackpad ────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") {
        const v = viewRef.current;
        setView(zoomAt(Math.min(MAX_ZOOM, v.zs * 1.6), { x: W / 2, y: H / 2 }, v, true));
      } else if (e.key === "-") {
        const v = viewRef.current;
        setView(settle(zoomAt(Math.max(1, v.zs / 1.6), { x: W / 2, y: H / 2 }, v, true)));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, go, zoomAt, settle, W, H]);

  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // trackpad pinch arrives as ctrl+wheel; a zoomed photo pans with the wheel
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (e.ctrlKey) {
        e.preventDefault();
        const s = clamp(v.zs * Math.exp(-e.deltaY * 0.01), 1, MAX_ZOOM);
        setView(s === 1 ? { ...v, zs: 1, zx: 0, zy: 0, anim: true } : zoomAt(s, { x: e.clientX, y: e.clientY }, v, true));
      } else if (v.zs > 1.01) {
        e.preventDefault();
        const b = bounds(v.zs);
        setView({
          ...v,
          zx: clamp(v.zx - e.deltaX, b.minX, b.maxX),
          zy: clamp(v.zy - e.deltaY, b.minY, b.maxY),
          anim: false,
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, bounds, mounted]);

  /* ── the strip follows the photo ───────────────────────────────────── */
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (!strip || !el) return;
    strip.scrollTo({
      left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2,
      behavior: phase === "open" && !reduced ? "smooth" : "auto",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mounted]);

  /* ── share ─────────────────────────────────────────────────────────── */
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast(i18n.copied);
      window.setTimeout(() => setToast(null), 1800);
    } catch {
      // dismissed share sheet
    }
  };

  if (!mounted || !W) return null;

  const dur = reduced ? 0 : DURATION;
  const trans = (props: string[]) =>
    view.anim ? props.map((p) => `${p} ${dur}ms ${EASE}`).join(", ") : "none";

  const slideStyle = (i: number): CSSProperties => {
    const p = photos[i];
    const r = fitRect(p, W, H);
    const base: CSSProperties = {
      position: "absolute",
      left: r.x + (i - index) * (W + GAP),
      top: r.y,
      width: r.w,
      height: r.h,
      transformOrigin: "0 0",
      willChange: "transform",
    };
    if (i !== index) return base;
    const transform = morph
      ? morph.t
      : `translate3d(${view.zx + view.dx + ((1 - view.ds) * r.w) / 2}px, ${
          view.zy + view.dy + ((1 - view.ds) * r.h) / 2
        }px, 0) scale(${view.zs * view.ds})`;
    return {
      ...base,
      transform,
      clipPath: morph ? morph.clip : `inset(0px 0px 0px 0px round 0px)`,
      transition:
        phase === "opening" && morph
          ? "none"
          : morph || view.anim
            ? `transform ${dur}ms ${EASE}, clip-path ${dur}ms ${EASE}, opacity ${dur}ms ease`
            : "none",
      opacity: phase === "closing" && !morph ? 0 : 1,
    };
  };

  const showChrome = chrome && phase === "open";
  // the bars' gradients let gestures through; only their controls take taps
  const chromeStyle: CSSProperties = {
    opacity: showChrome ? 1 : 0,
    transition: `opacity ${reduced ? 0 : 220}ms ease`,
  };
  const live: CSSProperties = { pointerEvents: showChrome ? "auto" : "none" };
  const btn =
    "tap flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-xl transition-colors hover:bg-white/20";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] select-none overflow-hidden text-white"
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      data-lenis-prevent
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: view.bg, transition: phase === "opening" ? `opacity ${dur}ms ease` : trans(["opacity"]) }}
      />

      {/* stage: the slides and every gesture */}
      <div
        ref={stageRef}
        className="absolute inset-0"
        style={{ touchAction: "none", cursor: view.zs > 1.01 ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translate3d(${view.tx}px, 0, 0)`, transition: trans(["transform"]) }}
        >
          {[index - 1, index, index + 1]
            .filter((i) => i >= 0 && i <= last)
            .map((i) => {
              const p = photos[i];
              return (
                <div key={p.id} style={slideStyle(i)} onDoubleClick={(e) => e.preventDefault()}>
                  {/* the grid's thumbnail (already loaded) holds the place until the big one arrives */}
                  <Image src={p.url} alt="" fill sizes={thumbSizes} className="object-cover" draggable={false} />
                  <Image
                    src={p.url}
                    alt={p.alt}
                    fill
                    sizes="100vw"
                    quality={85}
                    priority={i === index}
                    draggable={false}
                    onLoad={() => setLoaded((l) => ({ ...l, [p.id]: true }))}
                    className="object-cover transition-opacity duration-300"
                    style={{ opacity: loaded[p.id] ? 1 : 0 }}
                  />
                </div>
              );
            })}
        </div>
      </div>

      {/* top bar */}
      <div
        data-chrome
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/60 via-black/25 to-transparent px-3 pb-10 sm:px-5"
        style={{ ...chromeStyle, paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button type="button" onClick={close} aria-label={i18n.close} className={btn} style={live}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="min-w-0 pt-1 text-center leading-tight">
          <div className="truncate text-[0.95rem] font-semibold">{labels[photo.category] ?? photo.category}</div>
          <div className="text-[0.75rem] tabular-nums text-white/65">
            {index + 1} {i18n.of} {photos.length}
          </div>
        </div>
        <button type="button" onClick={share} aria-label={i18n.share} className={btn} style={live}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </button>
      </div>

      {/* desktop arrows */}
      {index > 0 && (
        <button
          data-chrome
          type="button"
          onClick={() => go(-1)}
          aria-label={i18n.prev}
          className={`${btn} absolute left-4 top-1/2 hidden -translate-y-1/2 [@media(hover:hover)]:flex`}
          style={{ ...chromeStyle, ...live }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {index < last && (
        <button
          data-chrome
          type="button"
          onClick={() => go(1)}
          aria-label={i18n.next}
          className={`${btn} absolute right-4 top-1/2 hidden -translate-y-1/2 [@media(hover:hover)]:flex`}
          style={{ ...chromeStyle, ...live }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* bottom strip: scrub through the set */}
      <div
        data-chrome
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent pt-10"
        style={{ ...chromeStyle, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div
          ref={stripRef}
          className="scroll-none flex items-center gap-[2px] overflow-x-auto px-[50%]"
          style={{ scrollbarWidth: "none", ...live }}
        >
          {photos.map((p, i) => {
            const active = i === index;
            return (
              <button
                key={p.id}
                type="button"
                data-i={i}
                onClick={() => jump(i)}
                aria-label={`${i + 1} ${i18n.of} ${photos.length}`}
                aria-current={active || undefined}
                className="relative h-12 shrink-0 overflow-hidden rounded-[3px] transition-all duration-300"
                style={{
                  width: active ? Math.round((48 * p.width) / p.height) : 30,
                  marginInline: active ? 6 : 0,
                  opacity: active ? 1 : 0.6,
                }}
              >
                <Image src={p.url} alt="" fill sizes="96px" className="object-cover" draggable={false} />
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur-xl">
          {toast}
        </div>
      )}
    </div>,
    document.body
  );
}
