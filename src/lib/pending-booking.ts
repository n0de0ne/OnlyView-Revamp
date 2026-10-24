/**
 * The table a guest went to book on a restaurant's own site. Kept in the
 * browser so that, back in the portal, we can ask "Did you book it?" and put
 * it on the stay. Client-only; storage may be unavailable (private mode).
 */

import type { BookingPlatform } from "./booking-platforms";

export interface PendingBooking {
  reservationId: number;
  placeId: number;
  name: string;
  date: string;
  time: string | null;
  guests: number;
  platform: BookingPlatform;
  at: number;
}

const KEY = "onlyview:pending-booking";
/** after this the question is stale — the guest has moved on */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function savePendingBooking(p: Omit<PendingBooking, "at">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* no storage: the guest just won't be asked */
  }
}

export function loadPendingBooking(reservationId: number): PendingBooking | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as PendingBooking | null;
    if (!p || p.reservationId !== reservationId) return null;
    if (Date.now() - p.at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
