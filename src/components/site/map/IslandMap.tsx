"use client";

/**
 * The island explorer: a sticky map beside a filterable ledger of places.
 * The ledger, the filters and the search render on the server (that text
 * is what crawlers and answer engines read); only the Leaflet canvas waits
 * for the browser. `#slug` in the URL opens that place.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { MapCommand, RouteState } from "./LeafletMap";
import { fmtKm, fmtWalk, googleMapsDirectionsUrl, walkMinutes, wazeUrl } from "./routing";

const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-sand-dark">
      <span className="eyebrow animate-pulse">…</span>
    </div>
  ),
});

type Filter = "all" | MapCategory;

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
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);

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

  const focus = (p: MapPlaceDTO, scroll = true) => {
    if (filter !== "all" && filter !== p.category) setFilter("all");
    if (scroll && window.innerWidth < 1024) {
      mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setCommand({ type: "focus", id: p.id, nonce: ++nonce.current });
  };
  const clearRoute = () => setCommand({ type: "clear", nonce: ++nonce.current });

  // #slug → that place, on load and when the hash changes
  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      const p = slug && places.find((x) => x.slug === slug);
      if (p) setTimeout(() => focus(p, false), 600);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  // the ledger follows the map: the open pin's row scrolls into view
  useEffect(() => {
    if (selected == null) return;
    const p = places.find((x) => x.id === selected);
    const row = p && document.getElementById(p.slug);
    const panel = ledgerRef.current;
    if (!row || !panel) return;
    if (window.innerWidth >= 1024) {
      panel.scrollTo({ top: row.offsetTop - 64, behavior: "smooth" });
    }
  }, [selected, places]);

  const visible = filter === "all" ? [] : [filter];

  return (
    <div className="mx-auto max-w-7xl px-5 lg:px-8">
      {/* ── filters: the gallery's chips ── */}
      <div className="scroll-thin -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label={t.label}>
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
              className={`tap flex min-h-[44px] shrink-0 items-center gap-2 border px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? "border-gold bg-gold text-white"
                  : "border-ink/15 text-ink/60 hover:border-gold hover:text-gold"
              }`}
            >
              {f !== "all" && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? "#fff" : CATEGORY_META[f].color }}
                  aria-hidden
                />
              )}
              {f === "all" ? t.all : catLabel(f)}
              <span className={active ? "text-white/70" : "text-ink/35"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12">
        {/* ── the ledger: scrolls inside its panel beside the sticky map ── */}
        <div
          ref={ledgerRef}
          className="scroll-thin order-2 lg:order-1 lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)] lg:overflow-y-auto lg:pr-5"
        >
          <div className="relative border-b border-ink/15 bg-sand lg:sticky lg:top-0 lg:z-10">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="w-full bg-transparent py-3 pr-10 text-sm text-ink outline-none placeholder:text-ink/40"
            />
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[0.68rem] uppercase tracking-[0.16em] text-ink/40">
              {shownCount}
            </span>
          </div>

          {shownCount === 0 && <p className="py-10 text-center text-sm text-ink/50">{t.noResults}</p>}

          {groups.map(({ cat, list }) => (
            <section key={cat} className="mt-9" aria-labelledby={`map-${cat}`}>
              <div className="mb-1 flex items-baseline justify-between gap-4">
                <h3 id={`map-${cat}`} className="font-display text-2xl text-ink">
                  {cat === "beach" ? t.beachesTitle : catLabel(cat)}
                </h3>
                <span className="eyebrow !mb-0 !text-ink/40">{list.length}</span>
              </div>
              <ul>
                {list.map((p) => {
                  const { color } = pinStyle(p);
                  const isSel = selected === p.id;
                  const meta = [kindLabel(p, locale), p.zone].filter(Boolean).join(" · ");
                  return (
                    <li key={p.id} id={p.slug} className="scroll-mt-32">
                      <button
                        type="button"
                        onClick={() => focus(p)}
                        aria-pressed={isSel}
                        className={`group grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-x-3 border-t border-ink/10 py-3.5 text-left transition ${
                          isSel ? "bg-white" : "hover:bg-white/60"
                        }`}
                      >
                        <span
                          className="mt-1.5 h-2 w-2 self-start rounded-full ring-2 ring-white"
                          style={{ background: color }}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className={`block font-semibold ${isSel ? "text-gold" : "text-ink group-hover:text-gold"} transition`}>
                            {p.name}
                          </span>
                          <span className="block text-[0.72rem] uppercase tracking-[0.12em] text-ink/45">{meta}</span>
                          {p.description && (
                            <span className="mt-1 hidden text-sm leading-snug text-ink/65 sm:block">{p.description}</span>
                          )}
                        </span>
                        <span className="whitespace-nowrap text-sm font-semibold text-gold">
                          {p.driveMinutes ? `${p.driveMinutes} ${t.min}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* ── the map, sticky on desktop ── */}
        <div className="order-1 lg:order-2">
          <div
            ref={mapBoxRef}
            className="relative z-0 h-[62svh] min-h-[420px] scroll-mt-24 overflow-hidden border border-ink/10 bg-sand-dark shadow-2xl shadow-ink/10 lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)]"
          >
            <LeafletMap
              villa={villa}
              places={places}
              visible={visible}
              command={command}
              onRoute={setRoute}
              onSelect={setSelected}
              labels={{
                villa: t.villa,
                villaSub: "Pointe Milou · Saint-Barthélemy",
                min: t.min,
                route: t.route,
                openMaps: t.openMaps,
                website: t.website,
                call: t.call,
                parking: t.parking,
                locale,
              }}
            />

            {/* legend, top-left, on glass */}
            <ul className="glass pointer-events-none absolute left-3 top-3 z-[400] hidden flex-col gap-1.5 px-3.5 py-3 text-[0.66rem] uppercase tracking-[0.14em] text-ink/70 sm:flex">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full ring-2 ring-white" style={{ background: "#c9a962" }} />
                {t.villa}
              </li>
              {MAP_CATEGORIES.filter((c) => (byCategory.get(c)?.length ?? 0) > 0).map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full ring-2 ring-white" style={{ background: CATEGORY_META[c].color }} />
                  {catLabel(c)}
                </li>
              ))}
            </ul>

            {/* itinerary, bottom, on glass */}
            {route && (
              <div className="glass absolute inset-x-3 bottom-3 z-[400] px-5 py-4 sm:inset-x-4 sm:bottom-4" role="status" aria-live="polite">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow !mb-1 !text-[0.62rem]">{t.routeTo}</p>
                    <p className="truncate font-display text-xl leading-tight text-ink">{route.place.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearRoute}
                    className="tap -mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-ink/50 hover:text-ink"
                    aria-label={t.close}
                  >
                    ✕
                  </button>
                </div>
                {route.status === "loading" ? (
                  <p className="mt-2 text-sm text-ink/60">{t.routing}</p>
                ) : (
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                    <div>
                      <dt className="inline text-ink/55">{t.distance} </dt>
                      <dd className="inline font-semibold text-ink">
                        {route.status === "approx" ? "~" : ""}
                        {fmtKm(route.distanceM)}
                      </dd>
                    </div>
                    {route.status === "ok" && (
                      <div>
                        <dt className="inline text-ink/55">{t.duration} </dt>
                        <dd className="inline font-semibold text-ink">
                          {Math.max(1, Math.round(route.durationS / 60))} {t.min}
                        </dd>
                      </div>
                    )}
                    {route.walkM > 0 && (
                      <div>
                        <dt className="inline text-ink/55">{t.thenWalk} </dt>
                        <dd className="inline font-semibold text-gold">
                          {walkMinutes(route.walkM)} {t.min} · {fmtWalk(route.walkM)}
                        </dd>
                      </div>
                    )}
                    {route.status === "approx" && (
                      <div className="basis-full text-xs text-ink/50">{t.approx}</div>
                    )}
                  </dl>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em]">
                  <a
                    href={googleMapsDirectionsUrl(villa, route.navTarget, route.via)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold-dark"
                  >
                    {t.openMaps} ↗
                  </a>
                  <a href={wazeUrl(route.navTarget)} target="_blank" rel="noopener noreferrer" className="text-ink/60 hover:text-gold">
                    {t.openWaze} ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          <noscript>
            <p className="mt-3 text-xs text-ink/50">{t.noscript}</p>
          </noscript>
        </div>
      </div>
    </div>
  );
}
