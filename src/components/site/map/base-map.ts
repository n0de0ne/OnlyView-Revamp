/**
 * The base map under every Leaflet map of the site — the public explorer and
 * the admin's place editor draw the same island: our own vector cartography
 * (map-style.ts) rendered by MapLibre, or softened OSM tiles where WebGL is
 * missing.
 */
import L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** adds the base map; the map needs explicit min/max zoom (no raster layer sets them) */
export async function addBaseMap(map: L.Map): Promise<"vector" | "raster"> {
  if (hasWebGL()) {
    try {
      const [{ islandStyle, MAP_ATTRIBUTION }] = await Promise.all([
        import("./map-style"),
        import("@maplibre/maplibre-gl-leaflet"),
      ]);
      L.maplibreGL({ style: islandStyle, attributionControl: false, maxZoom: 19 }).addTo(map);
      map.attributionControl?.addAttribution(MAP_ATTRIBUTION);
      return "vector";
    } catch {
      // fall through to the raster tiles
    }
  }
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: "map-osm-fallback",
  }).addTo(map);
  return "raster";
}
