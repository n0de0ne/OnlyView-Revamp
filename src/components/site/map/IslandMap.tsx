"use client";

/**
 * The interactive island map: category filters, a place search, the
 * Leaflet map, the itinerary panel and the text directory of every pin.
 * The directory and filters render on the server (crawlers read them); only
 * the Leaflet canvas waits for the browser.
 */
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import {
  CATEGORY_META,
  KIND_META,
  MAP_CATEGORIES,
  VILLA_PIN_COLOR,
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
    <div className="flex h-full w-full items-center justify-center bg-sand-dark text-sm text-ink/50">
      <span className="animate-pulse">Loading map…</span>
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
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);

  const catLabel = (c: MapCategory) => (fr ? CATEGORY_META[c].fr : CATEGORY_META[c].en);
  const byCategory = useMemo(() => {
    const m = new Map<MapCategory, MapPlaceDTO[]>();
    for (const c of MAP_CATEGORIES) m.set(c, []);
    for (const p of places) m.get(p.category)?.push(p);
    return m;
  }, [places]);

  const q = query.trim().toLowerCase();
  const results =
    q.length >= 2
      ? places
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.zone ?? "").toLowerCase().includes(q) ||
              catLabel(p.category).toLowerCase().includes(q)
          )
          .slice(0, 8)
      : [];

  const goTo = (p: MapPlaceDTO) => {
    setQuery("");
    if (filter !== "all" && filter !== p.category) setFilter("all");
    mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCommand({ type: "focus", id: p.id, nonce: ++nonce.current });
  };
  const clearRoute = () => setCommand({ type: "clear", nonce: ++nonce.current });

  const visible = filter === "all" ? [] : [filter];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8">
      {/* ── filters ── */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t.label}>
        {(["all", ...MAP_CATEGORIES] as Filter[]).map((f) => {
          const active = filter === f;
          const count = f === "all" ? places.length : byCategory.get(f)?.length ?? 0;
          if (f !== "all" && count === 0) return null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] transition ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:border-navy hover:text-navy"
              }`}
            >
              {f === "all" ? t.all : catLabel(f)}
              <span className={`ml-1.5 ${active ? "text-white/70" : "text-ink/40"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── search ── */}
      <div className="relative mx-auto mt-4 max-w-xl">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          className="w-full rounded-full border border-ink/15 bg-white py-2.5 pl-11 pr-4 text-sm text-ink outline-none transition focus:border-gold"
        />
        {q.length >= 2 && (
          <ul className="absolute left-0 right-0 top-full z-[500] mt-1 max-h-72 overflow-y-auto rounded-2xl border border-ink/10 bg-white py-1 shadow-xl">
            {results.length === 0 && (
              <li className="px-4 py-3 text-center text-sm text-ink/50">{t.noResults}</li>
            )}
            {results.map((p) => {
              const { color, emoji } = pinStyle(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => goTo(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-sand"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                      style={{ background: color }}
                    >
                      {emoji}
                    </span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-auto text-xs uppercase tracking-wide text-ink/45">
                      {p.zone ?? catLabel(p.category)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── map ── */}
      <div
        ref={mapBoxRef}
        className="relative z-0 mt-5 h-[65vh] min-h-[420px] overflow-hidden rounded-2xl border border-ink/10 bg-sand-dark"
      >
        <LeafletMap
          villa={villa}
          places={places}
          visible={visible}
          command={command}
          onRoute={setRoute}
          labels={{
            villa: t.villa,
            villaSub: "Pointe Milou, St Barth",
            fromVilla: t.fromVilla,
            min: t.min,
            route: t.route,
            openMaps: t.openMaps,
            website: t.website,
            call: t.call,
            parking: t.parking,
            locale,
          }}
        />
      </div>
      <noscript>
        <p className="mt-4 rounded-2xl bg-sand p-6 text-center text-sm text-ink/60">{t.noscript}</p>
      </noscript>

      {/* ── legend ── */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-ink/65">
        <li className="flex items-center gap-2">
          <span className="legend-dot" style={{ background: VILLA_PIN_COLOR }} /> {t.villa}
        </li>
        {MAP_CATEGORIES.filter((c) => (byCategory.get(c)?.length ?? 0) > 0).map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span className="legend-dot" style={{ background: CATEGORY_META[c].color }} /> {catLabel(c)}
          </li>
        ))}
      </ul>

      {/* ── itinerary panel ── */}
      {route && (
        <div
          className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-sand px-5 py-4"
          role="status"
          aria-live="polite"
        >
          <span className="font-display text-lg text-navy-deep">
            {t.routeTo} {route.place.name}
          </span>
          {route.status === "loading" ? (
            <span className="text-sm text-ink/60">{t.routing}</span>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/70">
              <span>
                🚗 {t.distance}:{" "}
                <strong className="text-navy-deep">
                  {route.status === "approx" ? "~" : ""}
                  {fmtKm(route.distanceM)}
                </strong>
              </span>
              {route.status === "ok" && (
                <span>
                  ⏱ {t.duration}:{" "}
                  <strong className="text-navy-deep">
                    {Math.max(1, Math.round(route.durationS / 60))} {t.min}
                  </strong>
                </span>
              )}
              {route.walkM > 0 && (
                <span className="font-semibold" style={{ color: "#FF5722" }}>
                  🚶 {t.thenWalk}: {walkMinutes(route.walkM)} {t.min} ({fmtWalk(route.walkM)})
                </span>
              )}
              {route.status === "approx" && (
                <span className="text-xs text-ink/50">{t.approx}</span>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <a
              href={googleMapsDirectionsUrl(villa, route.navTarget, route.via)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white"
            >
              🗺️ {t.openMaps}
            </a>
            <a
              href={wazeUrl(route.navTarget)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-ink/15 bg-white px-3.5 py-2 text-xs font-medium text-navy-deep"
            >
              🚗 {t.openWaze}
            </a>
            <button
              type="button"
              onClick={clearRoute}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-white hover:text-navy-deep"
              aria-label={t.close}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── directory: every pin as text, for readers and crawlers ── */}
      <section className="mt-16" aria-labelledby="map-directory">
        <h2 id="map-directory" className="section-title !text-3xl">
          {t.directory}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">{t.directoryIntro}</p>
        {MAP_CATEGORIES.map((c) => {
          const list = byCategory.get(c) ?? [];
          if (!list.length) return null;
          const meta = CATEGORY_META[c];
          return (
            <div key={c} className="mt-10" id={`map-${c}`}>
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg shadow"
                  style={{ background: meta.color }}
                  aria-hidden
                >
                  {meta.emoji}
                </span>
                <h3 className="font-display text-2xl text-navy-deep">
                  {c === "beach" ? t.beachesTitle : catLabel(c)}
                </h3>
                <span className="ml-auto text-xs uppercase tracking-[0.1em] text-ink/45">
                  {list.length} {catLabel(c)}
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => {
                  const kind = p.kind && p.kind !== "restaurant" ? KIND_META[p.kind] : undefined;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => goTo(p)}
                        className="flex w-full items-baseline gap-2 rounded-xl bg-sand px-4 py-3 text-left transition hover:-translate-y-px hover:shadow-md"
                      >
                        <span className="font-display text-lg font-semibold text-navy-deep">{p.name}</span>
                        <span className="flex-1 border-b border-dotted border-ink/20" aria-hidden />
                        <span className="shrink-0 text-xs font-medium text-ink/60">
                          {p.driveMinutes ? `${p.driveMinutes} ${t.min}` : p.zone ?? ""}
                          {p.driveMinutes && p.zone ? ` · ${p.zone}` : ""}
                        </span>
                      </button>
                      {(p.description || kind) && (
                        <p className="sr-only">
                          {kind ? `${fr ? kind.fr : kind.en}. ` : ""}
                          {p.description}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
