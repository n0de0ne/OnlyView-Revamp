/**
 * Online booking platforms the island's restaurants use, recognised from the
 * restaurant's booking link — no API key, no extra field to fill in admin.
 * Safe to import from client components (no server code here).
 */

export type BookingPlatform = "sevenrooms" | "zenchef" | "opentable" | "thefork";

export interface PlatformRef {
  platform: BookingPlatform;
  /** SevenRooms venue slug, Zenchef restaurant id; null for link-only platforms */
  id: string | null;
}

/** platforms whose public widget availability we read (the others get a pre-filled link) */
export const LIVE_SLOT_PLATFORMS: BookingPlatform[] = ["sevenrooms", "zenchef"];

export function detectPlatform(url: string | null | undefined): PlatformRef | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host.endsWith("sevenrooms.com")) {
    // /reservations/<slug> or /explore/<slug>/reservations/…
    const m = /^\/(?:reservations|explore)\/([^/?#]+)/.exec(u.pathname);
    return m ? { platform: "sevenrooms", id: decodeURIComponent(m[1]) } : null;
  }
  if (host.endsWith("zenchef.com")) {
    const rid = u.searchParams.get("rid") ?? /\/(\d{4,})/.exec(u.pathname)?.[1] ?? null;
    return rid ? { platform: "zenchef", id: rid } : null;
  }
  if (host.endsWith("opentable.com") || host.endsWith("opentable.fr")) return { platform: "opentable", id: null };
  if (host.endsWith("thefork.com") || host.endsWith("thefork.fr") || host.endsWith("lafourchette.com"))
    return { platform: "thefork", id: null };
  return null;
}

/**
 * The platform's own booking page, pre-filled as far as it allows.
 * date YYYY-MM-DD, time HH:MM.
 */
export function prefilledBookingUrl(
  url: string,
  ref: PlatformRef | null,
  q: { date?: string | null; time?: string | null; guests?: number | null }
): string {
  if (!ref) return url;
  const params = new URLSearchParams();
  switch (ref.platform) {
    case "sevenrooms":
      if (q.date) params.set("date", q.date);
      if (q.guests) params.set("party_size", String(q.guests));
      if (q.time) params.set("start_time", q.time);
      return `https://www.sevenrooms.com/explore/${encodeURIComponent(ref.id!)}/reservations/create/search/?${params}`;
    case "zenchef":
      params.set("rid", ref.id!);
      if (q.guests) params.set("pax", String(q.guests));
      if (q.date) params.set("day", q.date);
      return `https://bookings.zenchef.com/results?${params}`;
    case "opentable": {
      const u = new URL(url);
      if (q.guests) u.searchParams.set("covers", String(q.guests));
      if (q.date) u.searchParams.set("dateTime", `${q.date}T${q.time ?? "20:00"}`);
      return u.toString();
    }
    case "thefork":
      // TheFork's restaurant page has no stable pre-fill parameters
      return url;
  }
}

export const PLATFORM_LABELS: Record<BookingPlatform, string> = {
  sevenrooms: "SevenRooms",
  zenchef: "Zenchef",
  opentable: "OpenTable",
  thefork: "TheFork",
};
