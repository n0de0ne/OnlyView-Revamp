/**
 * The island map's own cartography, drawn by MapLibre from OpenFreeMap's
 * vector tiles (OpenStreetMap data, OpenMapTiles schema, free and keyless).
 *
 * A quiet palette after the system maps: warm land, clear blue water, soft
 * greens, white roads, sand on the beaches, and only the names that help —
 * villages, bays, and street names once you are close. No shops, no
 * transit, no reserve outlines over the sea: the pins carry the content.
 */
import type { StyleSpecification } from "maplibre-gl";

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const C = {
  land: "#f4f1ea",
  residential: "#efebe3",
  green: "#d6e9c6",
  wood: "#cfe5bf",
  sand: "#f6eac6",
  water: "#aedcf5",
  waterText: "#3f86b8",
  building: "#e7e2d8",
  buildingLine: "#ddd6c9",
  runway: "#dfe0e3",
  road: "#ffffff",
  roadCasing: "#e8e4db",
  majorCasing: "#d9d1c1",
  path: "#e4ded2",
  text: "#5e636a",
  roadText: "#80848b",
  halo: "#ffffff",
};

const width = (stops: Array<[number, number]>) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], ...stops.flat()] as unknown as number;

const MINOR = ["minor", "service", "track"];
const MAJOR = ["primary", "secondary", "tertiary", "trunk", "motorway"];

export const islandStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": C.land } },
    {
      id: "residential",
      type: "fill",
      source: "omt",
      "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
      paint: { "fill-color": C.residential },
    },
    {
      id: "green",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "wetland"]]],
      paint: { "fill-color": C.green, "fill-opacity": 0.8 },
    },
    {
      id: "wood",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": C.wood, "fill-opacity": 0.85 },
    },
    {
      // only real parks: the marine reserve would paint the sea green
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      filter: ["==", ["get", "class"], "park"],
      paint: { "fill-color": C.green, "fill-opacity": 0.7 },
    },
    {
      id: "sand",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "sand"],
      paint: { "fill-color": C.sand },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": C.water },
    },
    {
      id: "runway",
      type: "line",
      source: "omt",
      "source-layer": "aeroway",
      filter: ["in", ["get", "class"], ["literal", ["runway", "taxiway"]]],
      paint: { "line-color": C.runway, "line-width": width([[12, 2], [15, 14], [18, 50]]) },
    },
    {
      id: "building",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 15,
      paint: {
        "fill-color": C.building,
        "fill-outline-color": C.buildingLine,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 1],
      },
    },
    {
      id: "path",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 15,
      filter: ["==", ["get", "class"], "path"],
      layout: { "line-cap": "round" },
      paint: { "line-color": C.path, "line-width": 1.2, "line-dasharray": [1.5, 2] },
    },
    {
      id: "road-minor-casing",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", MINOR]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.roadCasing, "line-width": width([[13, 1.2], [16, 7], [19, 22]]) },
    },
    {
      id: "road-major-casing",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", MAJOR]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.majorCasing, "line-width": width([[10, 1], [13, 3], [16, 11], [19, 30]]) },
    },
    {
      id: "road-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", MINOR]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.road, "line-width": width([[13, 0.6], [16, 5], [19, 18]]) },
    },
    {
      id: "road-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", MAJOR]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.road, "line-width": width([[10, 0.5], [13, 2], [16, 8.5], [19, 26]]) },
    },
    {
      id: "road-name",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 15,
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name"], ["get", "name:latin"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-max-angle": 30,
      },
      paint: { "text-color": C.roadText, "text-halo-color": C.halo, "text-halo-width": 1.4 },
    },
    {
      id: "water-name",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      minzoom: 12,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ["get", "name:latin"]],
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 13],
        "text-max-width": 7,
        "text-letter-spacing": 0.04,
      },
      paint: { "text-color": C.waterText, "text-halo-color": "rgba(255,255,255,0.6)", "text-halo-width": 1 },
    },
    {
      id: "place-name",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["town", "village", "suburb"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name"], ["get", "name:latin"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          12, ["match", ["get", "class"], ["town"], 13, 10.5],
          16, ["match", ["get", "class"], ["town"], 16, 13],
        ],
        "text-max-width": 8,
        "text-letter-spacing": 0.02,
      },
      paint: { "text-color": C.text, "text-halo-color": C.halo, "text-halo-width": 1.5 },
    },
    {
      id: "place-name-minor",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      // the island is dotted with lieux-dits: only once you are close
      minzoom: 14,
      filter: ["in", ["get", "class"], ["literal", ["hamlet", "neighbourhood", "locality"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name"], ["get", "name:latin"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": [
          "interpolate", ["linear"], ["zoom"],
          12, ["match", ["get", "class"], ["town"], 13, 10.5],
          16, ["match", ["get", "class"], ["town"], 16, 13],
        ],
        "text-max-width": 8,
        "text-letter-spacing": 0.02,
      },
      paint: { "text-color": C.text, "text-halo-color": C.halo, "text-halo-width": 1.5 },
    },
  ],
};
