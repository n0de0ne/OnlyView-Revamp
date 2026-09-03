"use client";

/**
 * The editor's map: drop the pin, add the via-points the drive must pass
 * through, drag any of them, and test the resulting itinerary against the
 * router — the same one the public page uses.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ROUTE_COLOR,
  VILLA_PIN_COLOR,
  WALK_COLOR,
  pinStyle,
  type LatLng,
  type MapCategory,
} from "@/components/site/map/map-meta";
import {
  buildItinerary,
  fetchDrivingRoute,
  fmtKm,
  haversineM,
  walkMinutes,
} from "@/components/site/map/routing";

export type EditMode = "pin" | "via";

export interface AdminPlaceMapProps {
  villa: LatLng;
  lat: number | null;
  lng: number | null;
  category: MapCategory;
  kind: string | null;
  waypoints: LatLng[];
  walk: boolean;
  mode: EditMode;
  /** the other pins, faint, for orientation */
  others: Array<{ lat: number; lng: number; name: string; category: MapCategory; kind: string | null }>;
  onPin: (p: LatLng) => void;
  onWaypoints: (points: LatLng[]) => void;
}

const icon = (color: string, emoji: string, size: number) =>
  L.divIcon({
    html: `<div style="background:${color};border:2px solid #fff;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.55)}px;font-weight:700;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${emoji}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

export function AdminPlaceMap(props: AdminPlaceMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const editLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [test, setTest] = useState<null | { status: "loading" | "ok" | "fail"; km?: string; min?: number; walkMin?: number }>(null);

  /* ── map once ── */
  useEffect(() => {
    const el = elRef.current;
    if (!el || mapRef.current) return;
    const p = propsRef.current;
    const center: LatLng = p.lat != null && p.lng != null ? [p.lat, p.lng] : [17.9, -62.83];
    const map = L.map(el, { center, zoom: p.lat != null ? 15 : 13 });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.marker(p.villa, { icon: icon(VILLA_PIN_COLOR, "🏠", 30), zIndexOffset: 1000, interactive: false }).addTo(map);
    const others = L.layerGroup().addTo(map);
    for (const o of p.others) {
      const s = pinStyle(o);
      L.circleMarker([o.lat, o.lng], { radius: 5, color: "#fff", weight: 1, fillColor: s.color, fillOpacity: 0.55 })
        .bindTooltip(o.name)
        .addTo(others);
    }
    editLayer.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { mode, waypoints, onPin, onWaypoints } = propsRef.current;
      const pt: LatLng = [+e.latlng.lat.toFixed(7), +e.latlng.lng.toFixed(7)];
      if (mode === "pin") onPin(pt);
      else onWaypoints([...waypoints, pt]);
    });
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── redraw the editable pins whenever they change ── */
  useEffect(() => {
    const layer = editLayer.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const { lat, lng, waypoints, walk, category, kind, onPin, onWaypoints } = props;
    const s = pinStyle({ category, kind });
    if (lat != null && lng != null) {
      const m = L.marker([lat, lng], { icon: icon(s.color, s.emoji, 34), draggable: true, zIndexOffset: 900 });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        onPin([+ll.lat.toFixed(7), +ll.lng.toFixed(7)]);
      });
      layer.addLayer(m);
    }
    waypoints.forEach((wp, i) => {
      const last = i === waypoints.length - 1;
      const label = walk && last ? "P" : String(i + 1);
      const m = L.marker(wp, { icon: icon(WALK_COLOR, label, walk && last ? 24 : 20), draggable: true, zIndexOffset: 800 });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        const next = waypoints.slice();
        next[i] = [+ll.lat.toFixed(7), +ll.lng.toFixed(7)];
        onWaypoints(next);
      });
      m.bindTooltip(`Point ${i + 1} — glisser pour déplacer`);
      layer.addLayer(m);
    });
    // the drive, as a straight guide line until it is tested
    const guide: LatLng[] = [props.villa, ...waypoints];
    if (!(walk && waypoints.length) && lat != null && lng != null) guide.push([lat, lng]);
    layer.addLayer(L.polyline(guide, { color: ROUTE_COLOR, weight: 2, opacity: 0.35, dashArray: "4, 8" }));
    if (walk && waypoints.length && lat != null && lng != null) {
      layer.addLayer(
        L.polyline([waypoints[waypoints.length - 1], [lat, lng]], { color: WALK_COLOR, weight: 3, opacity: 0.8, dashArray: "8, 12" })
      );
    }
  }, [props]);

  // any change invalidates the last test
  useEffect(() => {
    routeLayer.current?.clearLayers();
    setTest(null);
  }, [props.lat, props.lng, props.waypoints, props.walk]);

  const runTest = async () => {
    const { villa, lat, lng, waypoints, walk } = propsRef.current;
    const map = mapRef.current;
    const layer = routeLayer.current;
    if (!map || !layer || lat == null || lng == null) return;
    layer.clearLayers();
    setTest({ status: "loading" });
    const it = buildItinerary(villa, {
      lat,
      lng,
      waypoints: waypoints.map((w) => w.join(",")).join("|") || null,
      walkFromLastWaypoint: walk,
    });
    const route = await fetchDrivingRoute(it.drive);
    if (!route) {
      setTest({ status: "fail" });
      return;
    }
    layer.addLayer(L.polyline(route.coords, { color: ROUTE_COLOR, weight: 5, opacity: 0.8 }));
    map.fitBounds(L.latLngBounds([...route.coords, [lat, lng]]), { padding: [30, 30] });
    const walkM = it.walk ? haversineM(it.walk[0], it.walk[1]) : 0;
    setTest({
      status: "ok",
      km: fmtKm(route.distanceM),
      min: Math.max(1, Math.round(route.durationS / 60)),
      walkMin: walkM ? walkMinutes(walkM) : undefined,
    });
  };

  return (
    <div className="space-y-2">
      <div ref={elRef} className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-80" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <button type="button" className="abtn-ghost !px-3 !py-1.5 text-xs" onClick={runTest} disabled={props.lat == null}>
          🚗 Tester l&apos;itinéraire
        </button>
        {test?.status === "loading" && <span>Calcul…</span>}
        {test?.status === "ok" && (
          <span>
            <strong>{test.km}</strong> · <strong>{test.min} min</strong> en voiture
            {test.walkMin ? (
              <>
                {" "}
                puis <strong>{test.walkMin} min</strong> à pied
              </>
            ) : null}
          </span>
        )}
        {test?.status === "fail" && <span className="text-red-600">Le routeur ne répond pas — réessayez.</span>}
      </div>
    </div>
  );
}
