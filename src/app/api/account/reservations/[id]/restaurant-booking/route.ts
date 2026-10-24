import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { serializeReservationExtra } from "@/lib/extras";
import { guestEditableReservation, notifyOwnerOfGuestUpdate } from "@/lib/guest-stay";
import { dateOrNull } from "@/lib/admin-schemas";
import { toISODate } from "@/lib/dates";
import { PLATFORM_LABELS } from "@/lib/booking-platforms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  placeId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  guests: z.number().int().min(1).max(100),
  platform: z.enum(["sevenrooms", "zenchef", "opentable", "thefork"]),
  /** the platform's booking number, when we have it (Zenchef widget) or the guest typed it */
  reference: z.string().trim().max(100).nullable().optional(),
  /** widget = captured from the embedded widget; guest = the guest said they booked */
  source: z.enum(["widget", "guest"]),
});

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

/**
 * A table the guest booked themselves on the restaurant's own system. It is
 * recorded on the stay as a confirmed, free extra so it shows with their other
 * plans (and, later, in the itinerary).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return bad("not_found", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid_input");
  const d = parsed.data;
  if (d.date < toISODate(r.startDate) || d.date > toISODate(r.endDate)) return bad("outside_stay");
  const place = await prisma.mapPlace.findUnique({ where: { id: d.placeId } });
  if (!place || place.category !== "restaurant") return bad("not_found", 404);

  const platform = PLATFORM_LABELS[d.platform];
  // the Zenchef widget can report the same booking twice (event + retry)
  if (d.reference) {
    const dupe = await prisma.reservationExtra.findFirst({
      where: { reservationId: r.id, notes: { contains: `#${d.reference}` } },
    });
    if (dupe) return NextResponse.json({ success: true, item: serializeReservationExtra(dupe) });
  }
  // notes are for the owner, who reads the admin in French
  const notes = [
    d.time,
    `${d.guests} pers.`,
    `réservé par le client sur ${platform}${d.reference ? ` #${d.reference}` : ""}`,
    d.source === "guest" ? "déclaré par le client" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const item = await prisma.reservationExtra.create({
    data: {
      reservationId: r.id,
      extraId: null,
      label: `Restaurant — ${place.name}`,
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      status: "confirmed",
      serviceDate: dateOrNull(d.date),
      notes,
      requestedByGuest: true,
    },
  });
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: `Table booked by the guest: ${place.name}`,
    lines: [
      `${d.date}${d.time ? ` at ${d.time}` : ""} · ${d.guests} guest${d.guests > 1 ? "s" : ""}`,
      `Booked on ${platform}${d.reference ? ` (ref. ${d.reference})` : ""}${d.source === "guest" ? " — as told by the guest" : ""}`,
      "Nothing to do — it is on the stay under Extras.",
    ],
  });
  return NextResponse.json({ success: true, item: serializeReservationExtra(item) });
}
