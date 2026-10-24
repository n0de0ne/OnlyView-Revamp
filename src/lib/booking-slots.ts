import "server-only";
import type { PlatformRef } from "./booking-platforms";

/**
 * Live free times for a restaurant, read from the same public endpoints the
 * platforms' own booking widgets call. These are undocumented: any surprise
 * (network, shape change, bot wall) yields null and the portal falls back to
 * a plain concierge request — it never breaks the page.
 */

export interface Slot {
  /** HH:MM, local to St Barth */
  time: string;
  /** false = the platform only takes a request / waitlist for this time */
  bookable: boolean;
  /** the venue's own short note for this time ("€180 prepayment") */
  note?: string;
}

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 6000;
const cache = new Map<string, { at: number; slots: Slot[] | null }>();

const HEADERS = {
  Accept: "application/json",
  // a plain browser UA — the widgets' endpoints refuse obvious bots
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "19:30", "7:30 PM", "2026-12-15 19:30:00" → "19:30" */
function hhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const iso = /(?:^|[ T])(\d{2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
  if (iso) return `${iso[1]}:${iso[2]}`;
  const ampm = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(v.trim());
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (ampm[3].toUpperCase() === "PM") h += 12;
    return `${String(h).padStart(2, "0")}:${ampm[2]}`;
  }
  const plain = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  return plain ? `${plain[1].padStart(2, "0")}:${plain[2]}` : null;
}

/** every object under `node` that has key `key` holding an array */
function collect(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === key && Array.isArray(v)) out.push(...v);
      else collect(v, key, out);
    }
  }
  return out;
}

/** does `key` appear anywhere in `node`? — tells "fully booked" from "shape changed" */
function has(node: unknown, key: string): boolean {
  if (Array.isArray(node)) return node.some((n) => has(n, key));
  if (node && typeof node === "object")
    return Object.entries(node).some(([k, v]) => k === key || has(v, key));
  return false;
}

function tidy(slots: Slot[]): Slot[] {
  const byTime = new Map<string, Slot>();
  for (const s of slots) {
    const prev = byTime.get(s.time);
    byTime.set(s.time, {
      time: s.time,
      bookable: s.bookable || !!prev?.bookable,
      ...((s.note ?? prev?.note) ? { note: s.note ?? prev?.note } : {}),
    });
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** SevenRooms widget: data.availability[date][shift].times[] */
async function sevenrooms(venue: string, date: string, guests: number): Promise<Slot[]> {
  const [y, m, d] = date.split("-");
  const params = new URLSearchParams({
    venue,
    time_slot: "19:00",
    party_size: String(guests),
    // ±16 h around time_slot in 15-min steps: the whole day, lunch included
    halo_size_interval: "64",
    start_date: `${m}-${d}-${y}`,
    num_days: "1",
    channel: "SEVENROOMS_WIDGET",
  });
  const json = await getJson(`https://www.sevenrooms.com/api-yoa/availability/widget/range?${params}`);
  if (!has(json, "availability")) throw new Error("unexpected response");
  const slots: Slot[] = [];
  for (const t of collect(json, "times") as Array<Record<string, unknown>>) {
    const time = hhmm(t.time_iso) ?? hhmm(t.time);
    if (!time || t.is_closed === true) continue;
    const note =
      typeof t.public_time_slot_description === "string" && t.public_time_slot_description.trim()
        ? t.public_time_slot_description.trim().slice(0, 120)
        : undefined;
    // "book" = instant booking; "request" = the venue takes a request
    if (t.type === "book") slots.push({ time, bookable: true, note });
    else if (t.type === "request") slots.push({ time, bookable: false, note });
  }
  return tidy(slots);
}

/** Zenchef widget: [{ shifts: [{ shift_slots: [{ name: "19:00", possible_guests: [...] }] }] }] */
async function zenchef(rid: string, date: string, guests: number): Promise<Slot[]> {
  const params = new URLSearchParams({ restaurantId: rid, date_begin: date, date_end: date });
  const json = await getJson(`https://bookings-middleware.zenchef.com/getAvailabilities?${params}`);
  // a closed day comes back as an empty list
  if (!(Array.isArray(json) && json.length === 0) && !has(json, "shifts")) throw new Error("unexpected response");
  const slots: Slot[] = [];
  for (const s of collect(json, "shift_slots") as Array<Record<string, unknown>>) {
    const time = hhmm(s.name) ?? hhmm(s.slot_name);
    if (!time || s.closed === true || s.marked_as_full === true) continue;
    const pax = s.possible_guests;
    const waitlist = s.waitlist_possible_guests;
    if (Array.isArray(pax) && pax.includes(guests)) slots.push({ time, bookable: true });
    else if (Array.isArray(waitlist) && waitlist.includes(guests)) slots.push({ time, bookable: false });
    else if (!Array.isArray(pax)) slots.push({ time, bookable: true });
  }
  return tidy(slots);
}

/**
 * Free times on `date` (YYYY-MM-DD) for `guests`, or null when the platform
 * has no readable availability or didn't answer.
 */
export async function getLiveSlots(ref: PlatformRef, date: string, guests: number): Promise<Slot[] | null> {
  if (!ref.id || (ref.platform !== "sevenrooms" && ref.platform !== "zenchef")) return null;
  const key = `${ref.platform}:${ref.id}:${date}:${guests}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slots;
  let slots: Slot[] | null;
  try {
    slots = ref.platform === "sevenrooms" ? await sevenrooms(ref.id, date, guests) : await zenchef(ref.id, date, guests);
  } catch (e) {
    console.warn(`[booking-slots] ${key}: ${(e as Error).message}`);
    slots = null;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), slots });
  return slots;
}
