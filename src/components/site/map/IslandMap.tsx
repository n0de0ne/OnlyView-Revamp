"use client";

/**
 * The island explorer, laid out like the system maps app: the map fills the
 * frame and the places live in a panel over it — a bottom sheet with three
 * resting heights on a phone (drag it, flick it, or tap its grabber), a
 * floating card on the left on a desktop. Tapping a pin or a row turns the
 * panel into that place's card: drive time, itinerary, Maps, call, website.
 *
 * The list, the filters and the search render on the server (that text is
 * what crawlers and answer engines read); only the Leaflet canvas waits for
 * the browser. `#slug` in the URL opens that place.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import {
  CATEGORY_META,
  MAP_CATEGORIES,
  kindLabel,
  pinStyle,
  type LatLng,
  type MapCategory,
  type MapPlaceDTO,
} from "./map-meta";
import type { LocateStatus, MapCommand, MapInsets, RouteState } from "./LeafletMap";
import { fmtKm, fmtWalk, googleMapsDirectionsUrl, walkMinutes, wazeUrl, buildItinerary } from "./routing";

const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f2efe9]">
      <span className="eyebrow animate-pulse">…</span>
    </div>
  ),
});

type Filter = "all" | MapCategory;
type Detent = "peek" | "half" | "full";

/** the panel's width on a desktop, and the gap around it */
const SIDE_W = 384;
const SIDE_GAP = 16;
/** iOS's sheet curve */
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export function IslandMap({
  villa,
  places,
  locale,
  t,
}: {
  villa: LatLng;
  places: MapPlaceDTO[];
  locale: "en" | "fr";
  t: Dict["map"];
}) {
  const fr = locale === "fr";
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [route, setRoute] = useState<RouteState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [locateStatus, setLocateStatus] = useState<LocateStatus>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [detent, setDetent] = useState<Detent>("peek");
  const [frameH, setFrameH] = useState(0);
  const [headH, setHeadH] = useState(148);
  const [drag, setDrag] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);

  const send = useCallback((c: { type: MapCommand["type"] } & Record<string, unknown>) => {
    setCommand({ ...c, nonce: ++nonce.current } as MapCommand);
  }, []);

  /** phone, in the page flow: bring the whole frame on screen (between the
   *  site's top bar and tab bar) so the sheet is never cut off at the bottom */
  const frameIntoView = () => {
    const el = frameRef.current;
    if (!el || fullscreen || window.innerWidth >= 1024) return;
    const r = el.getBoundingClientRect();
    if (r.top < 48 || r.bottom > window.innerHeight - 56) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const catLabel = (c: MapCategory) => (fr ? CATEGORY_META[c].fr : CATEGORY_META[c].en);
  const byCategory = useMemo(() => {
    const m = new Map<MapCategory, MapPlaceDTO[]>();
    for (const c of MAP_CATEGORIES) m.set(c, []);
    for (const p of places) m.get(p.category)?.push(p);
    return m;
  }, [places]);

  const q = query.trim().toLowerCase();
  const matches = (p: MapPlaceDTO) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    (p.zone ?? "").toLowerCase().includes(q) ||
    kindLabel(p, locale).toLowerCase().includes(q);
  const groups = MAP_CATEGORIES.map((c) => ({
    cat: c,
    list: (byCategory.get(c) ?? []).filter((p) => (filter === "all" || filter === c) && matches(p)),
  })).filter((g) => g.list.length > 0);
  const shownCount = groups.reduce((n, g) => n + g.list.length, 0);
  const place = selected == null ? null : places.find((p) => p.id === selected) ?? null;
  const routeHere = route && place && route.place.id === place.id ? route : null;

  /* ── layout: desktop or phone, the frame's height, the sheet header's ── */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    const el = frameRef.current;
    const head = headRef.current;
    if (!el || !head) return;
    const ro = new ResizeObserver(() => {
      setFrameH(el.clientHeight);
      setHeadH(head.offsetHeight);
    });
    ro.observe(el);
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  const topGap = fullscreen ? 56 : 10;
  const sheetH = Math.max(0, frameH - topGap);
  const detentPx = (d: Detent) =>
    d === "full" ? sheetH : d === "half" ? Math.max(headH, Math.round(frameH * 0.5)) : Math.min(headH, sheetH);
  const restY = sheetH - detentPx(detent);
  const sheetY = drag ?? restY;

  const insets: MapInsets = desktop
    ? { top: 0, right: 64, bottom: 0, left: SIDE_W + SIDE_GAP * 2 }
    : { top: 0, right: 0, bottom: Math.min(detentPx(detent), Math.round(frameH * 0.6)), left: 0 };

  /* ── selecting, opening, closing ── */
  const open = (p: MapPlaceDTO) => {
    if (filter !== "all" && filter !== p.category) setFilter("all");
    if (route && route.place.id !== p.id) send({ type: "clear" });
    setSelected(p.id);
    setDetent((d) => (d === "full" || d === "peek" ? "half" : d));
    send({ type: "select", id: p.id });
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const close = () => {
    if (route) send({ type: "clear" });
    setSelected(null);
  };
  const startRoute = (p: MapPlaceDTO) => {
    send({ type: "route", id: p.id });
    setDetent("peek");
  };
  const onPin = (id: number | null) => {
    if (id == null) {
      // a tap on the map: back to the list, unless an itinerary is on screen
      if (!route) setSelected(null);
      return;
    }
    const p = places.find((x) => x.id === id);
    if (p) open(p);
  };

  // #slug → that place, on load and when the hash changes
  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      const p = slug && places.find((x) => x.slug === slug);
      if (p) setTimeout(() => open(p), 600);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  // Esc closes the card, then the full screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selected != null) close();
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // full screen: the page behind stops scrolling
  useEffect(() => {
    if (!fullscreen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [fullscreen]);

  // the locate messages fade on their own
  useEffect(() => {
    if (locateStatus !== "far" && locateStatus !== "denied") return;
    const id = setTimeout(() => setLocateStatus(null), 4500);
    return () => clearTimeout(id);
  }, [locateStatus]);

  /* ── the sheet's gesture (phone only) ──
   * A drag on the header always moves the sheet. A drag on the list moves
   * it too unless the sheet is fully open and the list has somewhere to
   * scroll — then the list scrolls, and pulling down from its top takes the
   * sheet down, as on iOS. On release, the flick's speed picks the detent. */
  const g = useRef({ y0: 0, t0: 0, base: 0, mode: "idle" as "idle" | "sheet" | "scroll", inHead: false, last: 0, lastT: 0, v: 0 });
  const stateRef = useRef({ restY, detent, desktop, sheetH });
  stateRef.current = { restY, detent, desktop, sheetH };

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const start = (e: TouchEvent) => {
      if (stateRef.current.desktop) return;
      frameIntoViewRef.current();
      const y = e.touches[0].clientY;
      g.current = {
        y0: y,
        t0: e.timeStamp,
        base: stateRef.current.restY,
        mode: "idle",
        inHead: !!headRef.current?.contains(e.target as Node),
        last: y,
        lastT: e.timeStamp,
        v: 0,
      };
    };
    const move = (e: TouchEvent) => {
      if (stateRef.current.desktop) return;
      const s = g.current;
      const y = e.touches[0].clientY;
      const dy = y - s.y0;
      if (s.mode === "idle") {
        if (Math.abs(dy) < 6) return;
        const body = bodyRef.current;
        const atTop = !body || body.scrollTop <= 0;
        const full = stateRef.current.detent === "full";
        s.mode = s.inHead || !full || (atTop && dy > 0) ? "sheet" : "scroll";
        // the gesture starts here: no jump by the threshold
        s.y0 = y;
      }
      if (s.mode !== "sheet") return;
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - s.lastT);
      s.v = (y - s.last) / dt;
      s.last = y;
      s.lastT = e.timeStamp;
      const max = stateRef.current.sheetH;
      let next = s.base + (y - s.y0);
      // rubber band past the ends
      if (next < 0) next = next / 3;
      if (next > max) next = max + (next - max) / 3;
      setDrag(next);
    };
    const end = () => {
      const s = g.current;
      if (s.mode !== "sheet") {
        s.mode = "idle";
        return;
      }
      s.mode = "idle";
      setDrag((cur) => {
        if (cur == null) return null;
        // where the flick would carry the sheet, then the nearest rest
        const projected = cur + s.v * 220;
        const { sheetH: H } = stateRef.current;
        const options: Detent[] = ["full", "half", "peek"];
        let best: Detent = "peek";
        let bestD = Infinity;
        for (const d of options) {
          const y = H - detentPxRef.current(d);
          const dist = Math.abs(projected - y);
          if (dist < bestD) {
            best = d;
            bestD = dist;
          }
        }
        setDetent(best);
        return null;
      });
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);
  const frameIntoViewRef = useRef(frameIntoView);
  frameIntoViewRef.current = frameIntoView;
  const detentPxRef = useRef(detentPx);
  detentPxRef.current = detentPx;

  const cycleDetent = () => setDetent((d) => (d === "peek" ? "half" : d === "half" ? "full" : "peek"));

  /* ── pieces ── */
  const meta = (p: MapPlaceDTO) => [kindLabel(p, locale), p.zone].filter(Boolean).join(" · ");

  const chips = (
    <div className="scroll-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:-mx-5 lg:px-5" role="group" aria-label={t.label}>
      {(["all", ...MAP_CATEGORIES] as Filter[]).map((f) => {
        const count = f === "all" ? places.length : byCategory.get(f)?.length ?? 0;
        if (count === 0) return null;
        const active = filter === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={active}
            className={`tap flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem] font-medium transition-colors ${
              active ? "bg-ink text-white shadow-sm" : "bg-ink/[0.06] text-ink/75 hover:bg-ink/10"
            }`}
          >
            {f === "all" ? (
              <span aria-hidden>✦</span>
            ) : (
              <span aria-hidden className="text-[0.95rem] leading-none">
                {CATEGORY_META[f].emoji}
              </span>
            )}
            {f === "all" ? t.all : catLabel(f)}
            <span className={`tabular-nums ${active ? "text-white/60" : "text-ink/40"}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );

  const searchField = (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden>
        <IconSearch />
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (desktop) return;
          frameIntoView();
          setDetent("full");
        }}
        placeholder={t.search}
        aria-label={t.search}
        className="h-11 w-full rounded-xl bg-ink/[0.06] pl-10 pr-14 text-base text-ink outline-none transition placeholder:text-ink/40 focus:bg-ink/[0.08] focus:ring-2 focus:ring-navy/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-ink/25 text-[0.7rem] text-white"
          aria-label={t.close}
        >
          ✕
        </button>
      ) : (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-ink/35">
          {shownCount}
        </span>
      )}
    </label>
  );

  const placeHead = place && (
    <div>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl shadow-sm ring-2 ring-white"
          style={{ background: pinStyle(place).color }}
          aria-hidden
        >
          {pinStyle(place).emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.6rem] leading-[1.1] text-ink">{place.name}</h3>
          <p className="mt-0.5 text-[0.82rem] text-ink/55">
            {meta(place)}
            {place.driveMinutes ? (
              <>
                {" · "}
                <span className="font-semibold text-navy">
                  🚗 {place.driveMinutes} {t.min}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="tap -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink/55 hover:bg-ink/10"
          aria-label={t.close}
        >
          <IconClose />
        </button>
      </div>

      {/* the action row, as on a place card */}
      <div className="mt-4 grid auto-cols-fr grid-flow-col gap-2">
        <ActionTile primary active={!!routeHere} onClick={() => startRoute(place)} icon={<IconRoute />} label={t.route} />
        {(() => {
          const it = buildItinerary(villa, place);
          return (
            // no origin: Google Maps starts from wherever the phone is
            <ActionTile href={googleMapsDirectionsUrl(null, it.navTarget, it.via)} icon={<IconMaps />} label={t.openMaps} />
          );
        })()}
        {place.phone && <ActionTile href={`tel:${place.phone.replace(/\s+/g, "")}`} icon={<IconPhone />} label={t.call} />}
        {place.website && <ActionTile href={place.website} icon={<IconGlobe />} label={t.website} />}
      </div>

      {routeHere && (
        <div className="mt-3 rounded-2xl bg-navy px-4 py-3.5 text-white" role="status" aria-live="polite">
          {routeHere.status !== "loading" || routeHere.fromMe ? (
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/55">
                {routeHere.fromMe ? `📍 ${t.routeFromYou}` : `🏠 ${t.routeFromVilla}`}
              </p>
              {/* switch the start: the guest's position ⇄ the villa */}
              {(routeHere.fromMe || routeHere.canFromMe) && routeHere.status !== "loading" && (
                <button
                  type="button"
                  onClick={() => send({ type: "route", id: routeHere.place.id, ...(routeHere.fromMe ? { from: "villa" } : {}) })}
                  className="tap shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[0.7rem] font-semibold text-white hover:bg-white/25"
                >
                  {routeHere.fromMe ? `🏠 ${t.routeFromVilla}` : `📍 ${t.routeFromYou}`}
                </button>
              )}
            </div>
          ) : null}
          {routeHere.status === "loading" ? (
            <p className="text-sm text-white/75">{t.routing}</p>
          ) : (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {routeHere.status === "ok" ? `${Math.max(1, Math.round(routeHere.durationS / 60))} ${t.min}` : "~"}
                </span>
                <span className="text-sm text-white/70">
                  {routeHere.status === "approx" ? "" : "· "}
                  {fmtKm(routeHere.distanceM)}
                </span>
              </p>
              {routeHere.walkM > 0 && (
                <p className="mt-0.5 text-[0.82rem] text-gold-light">
                  🚶 {t.thenWalk.toLowerCase()} {walkMinutes(routeHere.walkM)} {t.min} · {fmtWalk(routeHere.walkM)}
                </p>
              )}
              {routeHere.status === "approx" && <p className="mt-1 text-xs text-white/55">{t.approx}</p>}
            </>
          )}
          <div className="mt-3 flex gap-2">
            <a
              href={googleMapsDirectionsUrl(routeHere.fromMe ? null : routeHere.origin, routeHere.navTarget, routeHere.via)}
              target="_blank"
              rel="noopener noreferrer"
              className="tap flex h-9 flex-1 items-center justify-center rounded-full bg-white text-[0.8rem] font-semibold text-navy"
            >
              {t.openMaps} ↗
            </a>
            <a
              href={wazeUrl(routeHere.navTarget)}
              target="_blank"
              rel="noopener noreferrer"
              className="tap flex h-9 flex-1 items-center justify-center rounded-full bg-white/15 text-[0.8rem] font-semibold text-white"
            >
              {t.openWaze} ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="island-map mx-auto max-w-7xl px-3 sm:px-5 lg:px-8">
      <div
        ref={frameRef}
        data-lenis-prevent
        // `isolate`: the panels' z-indexes stay inside the frame, so in the
        // page flow the site's header and tab bar still pass over the map
        className={
          fullscreen
            ? "fixed inset-0 z-[80] isolate overflow-hidden bg-[#f2efe9]"
            : // below xl the site has a top bar and a bottom tab bar: the frame
              // fits between them, so the sheet's search never hides under the tabs
              "relative isolate h-[calc(100svh-8.5rem-env(safe-area-inset-bottom))] min-h-[480px] scroll-mt-16 overflow-hidden rounded-[26px] bg-[#f2efe9] shadow-[0_24px_60px_-24px_rgba(12,20,27,0.45)] ring-1 ring-ink/10 lg:h-[calc(100svh-10rem)] lg:min-h-[560px] lg:scroll-mt-20 xl:h-[calc(100svh-8rem)] xl:scroll-mt-24"
        }
      >
        <div className="absolute inset-0 z-0">
          <LeafletMap
            villa={villa}
            places={places}
            visible={filter === "all" ? [] : [filter]}
            command={command}
            selectedId={selected}
            hoveredId={hovered}
            insets={insets}
            onRoute={setRoute}
            onSelect={onPin}
            onLocate={setLocateStatus}
            labels={{ villa: t.villa, villaSub: "Pointe Milou · Saint-Barthélemy" }}
          />
        </div>

        {/* ── map controls, top right, on glass ── */}
        <div
          className="absolute right-3 z-[500] flex flex-col gap-2"
          style={{ top: fullscreen ? "max(12px, env(safe-area-inset-top))" : 12 }}
        >
          <div className="map-ctl">
            <CtlButton label={fullscreen ? t.exitFullscreen : t.fullscreen} onClick={() => setFullscreen((f) => !f)}>
              {fullscreen ? <IconCollapse /> : <IconExpand />}
            </CtlButton>
          </div>
          <div className="map-ctl">
            <CtlButton label={t.recenter} onClick={() => send({ type: "villa" })}>
              <span className="text-[1.05rem] leading-none">🏠</span>
            </CtlButton>
            <CtlButton label={t.fitAll} onClick={() => send({ type: "fit" })}>
              <IconIsland />
            </CtlButton>
            <CtlButton label={t.locate} onClick={() => send({ type: "locate" })} active={locateStatus === "ok"}>
              <span className={locateStatus === "locating" ? "animate-pulse" : ""}>
                <IconLocate filled={locateStatus === "ok"} />
              </span>
            </CtlButton>
          </div>
          {/* pinch does this on a phone */}
          <div className="hidden lg:block">
            <div className="map-ctl">
              <CtlButton label={t.zoomIn} onClick={() => send({ type: "zoom", delta: 1 })}>
                <span className="text-xl font-light leading-none">+</span>
              </CtlButton>
              <CtlButton label={t.zoomOut} onClick={() => send({ type: "zoom", delta: -1 })}>
                <span className="text-xl font-light leading-none">−</span>
              </CtlButton>
            </div>
          </div>
        </div>

        {/* ── a passing message ── */}
        {(locateStatus === "far" || locateStatus === "denied") && (
          <div
            className="map-glass absolute left-1/2 z-[600] w-[min(90%,360px)] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-[0.82rem] text-ink/80"
            style={{ top: fullscreen ? "max(12px, env(safe-area-inset-top))" : 12 }}
            role="status"
          >
            {locateStatus === "far" ? t.locateFar : t.locateDenied}
          </div>
        )}

        {/* ── the panel: bottom sheet on a phone, floating card on a desktop ── */}
        <div
          ref={sheetRef}
          className="map-glass absolute inset-x-0 bottom-0 z-[700] flex flex-col overflow-hidden rounded-t-[22px] lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-4 lg:!h-auto lg:!transform-none lg:rounded-[22px]"
          style={
            desktop
              ? { width: SIDE_W }
              : frameH
                ? {
                    height: sheetH,
                    transform: `translate3d(0, ${sheetY}px, 0)`,
                    transition: drag == null ? `transform 0.5s ${SHEET_EASE}` : "none",
                  }
                : { height: "calc(100% - 10px)", transform: "translate3d(0, calc(100% - 148px), 0)" }
          }
        >
          <div ref={headRef} className="shrink-0 px-4 pb-3 lg:px-5 lg:pt-5">
            <button
              type="button"
              onClick={cycleDetent}
              className="flex h-5 w-full items-center justify-center lg:hidden"
              aria-label={t.dragSheet}
            >
              <span className="h-[5px] w-9 rounded-full bg-ink/20" />
            </button>
            {place ? (
              placeHead
            ) : (
              <div className="space-y-3 pt-1 lg:pt-0">
                {searchField}
                {chips}
              </div>
            )}
          </div>

          <div
            ref={bodyRef}
            className={`scroll-thin min-h-0 flex-1 overscroll-contain border-t border-ink/[0.07] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:overflow-y-auto lg:px-5 ${
              desktop || detent === "full" ? "overflow-y-auto" : "overflow-hidden"
            }`}
          >
            {place ? (
              <div className="py-4">
                {place.description && <p className="text-[0.95rem] leading-relaxed text-ink/75">{place.description}</p>}
                {place.walkFromLastWaypoint && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-gold/10 px-3 py-2.5 text-[0.82rem] text-gold-dark">
                    <span aria-hidden>🅿️</span>
                    {t.parking}
                  </p>
                )}
                <dl className="mt-4 divide-y divide-ink/[0.07] rounded-2xl bg-white/70 px-4 text-sm">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink/50">{CATEGORY_META[place.category][fr ? "fr" : "en"]}</dt>
                    <dd className="text-right text-ink">{kindLabel(place, locale)}</dd>
                  </div>
                  {place.zone && (
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-ink/50">📍</dt>
                      <dd className="text-right text-ink">{place.zone}</dd>
                    </div>
                  )}
                  {place.driveMinutes ? (
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-ink/50">🚗</dt>
                      <dd className="text-right text-ink">
                        {place.driveMinutes} {t.min} {t.fromVilla}
                      </dd>
                    </div>
                  ) : null}
                  {place.phone && (
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-ink/50">{t.call}</dt>
                      <dd className="text-right">
                        <a href={`tel:${place.phone.replace(/\s+/g, "")}`} className="text-navy">
                          {place.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <>
                {shownCount === 0 && <p className="py-10 text-center text-sm text-ink/50">{t.noResults}</p>}
                {groups.map(({ cat, list }) => (
                  <section key={cat} className="pt-5" aria-labelledby={`map-${cat}`}>
                    <div className="mb-2 flex items-baseline justify-between gap-4 px-1">
                      <h3 id={`map-${cat}`} className="text-[1.05rem] font-semibold text-ink">
                        {cat === "beach" ? t.beachesTitle : catLabel(cat)}
                      </h3>
                      <span className="text-xs tabular-nums text-ink/40">{list.length}</span>
                    </div>
                    <ul className="overflow-hidden rounded-2xl bg-white/75 shadow-[0_1px_0_rgba(16,24,32,0.04)]">
                      {list.map((p) => {
                        const { color, emoji } = pinStyle(p);
                        return (
                          <li key={p.id} id={p.slug} className="scroll-mt-32 [&+li>button]:border-t [&+li>button]:border-ink/[0.07]">
                            <button
                              type="button"
                              onClick={() => open(p)}
                              onMouseEnter={() => setHovered(p.id)}
                              onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
                              className="group ml-0 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white active:bg-ink/[0.04]"
                            >
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1rem]"
                                style={{ background: color }}
                                aria-hidden
                              >
                                {emoji}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.95rem] font-medium text-ink">{p.name}</span>
                                <span className="block truncate text-[0.78rem] text-ink/50">{meta(p)}</span>
                                {p.description && <span className="sr-only">{p.description}</span>}
                              </span>
                              {p.driveMinutes ? (
                                <span className="shrink-0 rounded-full bg-ink/[0.05] px-2 py-0.5 text-[0.75rem] font-semibold tabular-nums text-navy">
                                  {p.driveMinutes} {t.min}
                                </span>
                              ) : null}
                              <span className="shrink-0 text-ink/25" aria-hidden>
                                ›
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <noscript>
        <p className="mt-3 text-xs text-ink/50">{t.noscript}</p>
      </noscript>
    </div>
  );
}

/* ── small parts ── */

function CtlButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`tap flex h-11 w-11 items-center justify-center ${active ? "text-[#0a84ff]" : "text-ink/75"} hover:text-ink`}
    >
      {children}
    </button>
  );
}

function ActionTile({
  label,
  icon,
  href,
  onClick,
  primary,
  active,
}: {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  active?: boolean;
}) {
  const cls = `tap flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.72rem] font-semibold transition-colors ${
    primary
      ? active
        ? "bg-navy-deep text-white"
        : "bg-navy text-white hover:bg-navy-deep"
      : "bg-white/80 text-navy hover:bg-white"
  }`;
  const inner = (
    <>
      <span aria-hidden>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
    </>
  );
  if (href) {
    const external = !href.startsWith("tel:");
    return (
      <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {inner}
    </button>
  );
}

const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const IconSearch = () => (
  <svg {...svg} width={17} height={17}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const IconClose = () => (
  <svg {...svg} width={14} height={14} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const IconRoute = () => (
  <svg {...svg}>
    <path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" fill="currentColor" stroke="none" />
  </svg>
);
const IconMaps = () => (
  <svg {...svg}>
    <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </svg>
);
const IconPhone = () => (
  <svg {...svg}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
const IconGlobe = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
const IconLocate = ({ filled }: { filled?: boolean }) => (
  <svg {...svg}>
    <path d="M20.5 3.5 3.5 10.6l7.1 2.8 2.8 7.1z" fill={filled ? "currentColor" : "none"} />
  </svg>
);
const IconIsland = () => (
  <svg {...svg}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
const IconExpand = () => (
  <svg {...svg} width={18} height={18}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
);
const IconCollapse = () => (
  <svg {...svg} width={18} height={18}>
    <path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7" />
  </svg>
);
