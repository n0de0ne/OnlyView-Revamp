import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guestEditableReservation } from "@/lib/guest-stay";
import { toISODate } from "@/lib/dates";
import { detectPlatform, prefilledBookingUrl } from "@/lib/booking-platforms";
import { getLiveSlots } from "@/lib/booking-slots";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

/**
 * Guest portal: a restaurant's free times on one day of the stay, read from
 * its online booking system. Signed-in guests only — this is not a public
 * proxy onto the platforms. slots = null means "couldn't tell", not "full".
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return bad("not_found", 404);
  const sp = req.nextUrl.searchParams;
  const placeId = parseInt(sp.get("place") ?? "", 10);
  const date = sp.get("date") ?? "";
  const guests = parseInt(sp.get("guests") ?? "", 10);
  if (!Number.isFinite(placeId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(guests >= 1 && guests <= 30)) {
    return bad("invalid_input");
  }
  if (date < toISODate(r.startDate) || date > toISODate(r.endDate)) return bad("outside_stay");

  const place = await prisma.mapPlace.findUnique({ where: { id: placeId } });
  if (!place || !place.isActive || place.category !== "restaurant" || !place.bookingUrl) return bad("not_found", 404);
  const ref = detectPlatform(place.bookingUrl);
  const slots = ref ? await getLiveSlots(ref, date, guests) : null;
  return NextResponse.json({
    success: true,
    platform: ref?.platform ?? null,
    slots,
    bookingUrl: prefilledBookingUrl(place.bookingUrl, ref, { date, guests }),
  });
}
