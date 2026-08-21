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
