/**
 * Sunset time at the villa for a given day — the NOAA solar position
 * algorithm (accurate to about a minute at these latitudes), so the home
 * page can say when the sun sets over the bay tonight without any service.
 *
 * St Barth is on Atlantic Standard Time all year (UTC−4, no daylight saving).
 */
const RAD = Math.PI / 180;
const ST_BARTH_OFFSET_H = -4;

/** sunset as decimal hours, St Barth local time */
export function sunsetHour(date: Date, lat: number, lng: number): number {
  // day of the year, at local noon
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  const g = ((2 * Math.PI) / 365) * (day - 1);
  // equation of time (minutes) and solar declination (radians)
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  // hour angle at the official sunset (sun centre 0.833° below the horizon)
  const cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD;
  const utcMinutes = 720 - 4 * (lng - ha) - eqTime;
  return (((utcMinutes / 60 + ST_BARTH_OFFSET_H) % 24) + 24) % 24;
}

export const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1}:00` : `${hh}:${String(mm).padStart(2, "0")}`;
};

/** 17.9149 → "17°54′N", -62.8162 → "62°48′W" */
export function dms(value: number, axis: "lat" | "lng"): string {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${d}°${String(m).padStart(2, "0")}′${hemi}`;
}
