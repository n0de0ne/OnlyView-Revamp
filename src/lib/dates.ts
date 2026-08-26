/**
 * All reservation dates are calendar dates (no time-of-day semantics).
 * They are stored as DateTime at UTC midnight and always compared as
 * `YYYY-MM-DD` strings to avoid timezone drift.
 */

export function toISODate(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function nightsBetween(startISO: string, endISO: string): number {
  const ms = fromISODate(endISO).getTime() - fromISODate(startISO).getTime();
  return Math.round(ms / 86400000);
}

/** Iterate every night of a stay: [start, end) */
export function* eachNight(startISO: string, endISO: string): Generator<string> {
  let cur = toISODate(startISO);
  const end = toISODate(endISO);
  while (cur < end) {
    yield cur;
    cur = addDays(cur, 1);
  }
}

export function monthDay(iso: string): { month: number; day: number } {
  const d = fromISODate(iso);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const FMT: Record<string, Intl.DateTimeFormat> = {};
export function formatDate(
  d: Date | string | null | undefined,
  locale: string = "en",
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  if (!d) return "—";
  const date = typeof d === "string" ? fromISODate(d) : d;
  const key = locale + JSON.stringify(opts);
  FMT[key] ??= new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    ...opts,
    timeZone: "UTC",
  });
  return FMT[key].format(date);
}

export function formatDateShort(d: Date | string | null | undefined, locale = "en"): string {
  return formatDate(d, locale, { day: "numeric", month: "short", year: "numeric" });
}

export function todayISO(): string {
  return toISODate(new Date());
}

/* ───────────────────────────── seasons ─────────────────────────────
 * The villa's business year runs September 1 → August 31: a season is
 * named after the year it starts in (season 2025 = Sep 2025 → Aug 2026),
 * so a winter high season is never split across two reporting periods.
 */

/** First month of a season (1-based): September. */
export const SEASON_START_MONTH = 9;

/** Season a date belongs to, as its starting year. */
export function seasonOf(d: Date | string): number {
  const iso = toISODate(d);
  const year = parseInt(iso.slice(0, 4), 10);
  const month = parseInt(iso.slice(5, 7), 10);
  return month >= SEASON_START_MONTH ? year : year - 1;
}

export function currentSeason(): number {
  return seasonOf(new Date());
}

/** Half-open ISO range of a season: [start, end). */
export function seasonRange(season: number): { start: string; end: string } {
  const mm = String(SEASON_START_MONTH).padStart(2, "0");
  return { start: `${season}-${mm}-01`, end: `${season + 1}-${mm}-01` };
}

/** Number of days in a season (365 or 366). */
export function seasonDays(season: number): number {
  const { start, end } = seasonRange(season);
  return nightsBetween(start, end);
}

/** "2025 – 2026" */
export function seasonLabel(season: number): string {
  return `${season} – ${season + 1}`;
}

/** "25/26" — compact form for tight UI. */
export function seasonLabelShort(season: number): string {
  return `${String(season).slice(2)}/${String(season + 1).slice(2)}`;
}

/** The season's 12 months in order (September first). */
export function seasonMonths(
  season: number
): Array<{ year: number; month: number; key: string }> {
  return Array.from({ length: 12 }, (_, i) => {
    const offset = SEASON_START_MONTH - 1 + i;
    const year = season + Math.floor(offset / 12);
    const month = (offset % 12) + 1;
    return { year, month, key: `${year}-${String(month).padStart(2, "0")}` };
  });
}

/** Index (0–11) of a month key within its season, September = 0. */
export function seasonMonthIndex(monthKey: string): number {
  const month = parseInt(monthKey.slice(5, 7), 10);
  return (month - SEASON_START_MONTH + 12) % 12;
}
