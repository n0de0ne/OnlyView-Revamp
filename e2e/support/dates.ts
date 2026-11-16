/** ISO days (YYYY-MM-DD), all in UTC like the app stores them. */
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => iso(new Date());
export const addDays = (day: string, n: number) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000));
export const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Each spec file books its test stays in its own stretch of the calendar (a
 * "lane"), far in the future, so suites running side by side never fight for
 * the same dates and never touch real bookings.
 *
 * `near` lanes stay inside the two years the public booking form accepts;
 * the others start beyond it.
 */
const LANES = [
  "booking-request",
  "booking-convert",
  "booking-ui",
  "contracts",
  "contracts-amendment",
  "contracts-ui",
  "portal",
  "portal-dates",
  "portal-dates-target",
  "extras",
  "concierge",
  "admin-reservations",
  "admin-reservations-ui",
  "admin-calendar",
  "admin-clients",
  "admin-finance",
  "admin-pricing",
  "admin-roles",
  "smoke",
] as const;
export type Lane = (typeof LANES)[number];

const NEAR: Lane[] = ["booking-request", "booking-convert", "booking-ui"];
const LANE_DAYS = 45;

/** First day of a lane. */
export function laneStart(lane: Lane): string {
  const near = NEAR.indexOf(lane);
  if (near >= 0) return addDays(today(), 430 + near * 90);
  return addDays(today(), 800 + LANES.filter((l) => !NEAR.includes(l)).indexOf(lane) * LANE_DAYS);
}

/** The n-th candidate window of a lane: 7-night-aligned slots, one after the other. */
export function laneWindow(lane: Lane, slot: number, nights = 7): { startDate: string; endDate: string } {
  const startDate = addDays(laneStart(lane), slot * (nights + 1));
  return { startDate, endDate: addDays(startDate, nights) };
}

/** The reporting season (1 September → 31 August) a day belongs to, named after the year it opens. */
export function seasonOf(day: string): number {
  const [y, m] = day.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}
