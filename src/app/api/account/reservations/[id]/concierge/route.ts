import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { serializeReservationExtra } from "@/lib/extras";
import { guestEditableReservation, notifyOwnerOfGuestUpdate } from "@/lib/guest-stay";
import { dateOrNull } from "@/lib/admin-schemas";
import { toISODate } from "@/lib/dates";
import { BOAT_OUTINGS, money } from "@/lib/concierge";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const common = {
  id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(100),
  notes: z.string().trim().max(1000).nullable().optional(),
  locale: z.enum(["en", "fr"]).default("en"),
};
const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("restaurant"), time: z.string().regex(/^\d{2}:\d{2}$/), ...common }),
  z.object({ type: z.literal("boat"), outing: z.enum(BOAT_OUTINGS.map((o) => o.key) as [string, ...string[]]), ...common }),
  z.object({ type: z.literal("chef"), time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), ...common }),
]);

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const contactLine = (c: { phone?: string | null; whatsapp?: string | null; email?: string | null }) =>
  [c.phone && `☎ ${c.phone}`, c.whatsapp && `WhatsApp ${c.whatsapp}`, c.email].filter(Boolean).join(" · ");

/**
 * Guest portal concierge: ask for a table, a boat or a private chef. The
 * request lands on the stay as an extra the owner confirms — at no price,
 * since these are usually paid to the provider; the owner sets one if the
 * villa bills it.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return bad("not_found", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("invalid_input");
  const d = parsed.data;
  // the service has to happen while the guest is on the island
  if (d.date < toISODate(r.startDate) || d.date > toISODate(r.endDate)) return bad("outside_stay");

  const t = getDict(d.locale).account.concierge;
  const time = "time" in d && d.time ? d.time : null;
  let label: string;
  let subject: string;
  const facts: string[] = [];
  const ownerLines: string[] = [];

  if (d.type === "restaurant") {
    const place = await prisma.mapPlace.findUnique({ where: { id: d.id } });
    if (!place || !place.isActive || place.category !== "restaurant" || !place.bookingMode) return bad("not_found", 404);
    label = `Restaurant — ${place.name}`;
    subject = `Table requested: ${place.name}`;
    const contact = contactLine(place);
    if (contact) ownerLines.push(`Restaurant: ${contact}`);
    if (place.bookingUrl) ownerLines.push(`Online booking: ${place.bookingUrl}`);
  } else if (d.type === "boat") {
    const boat = await prisma.boat.findUnique({ where: { id: d.id }, include: { partner: true } });
    const outing = BOAT_OUTINGS.find((o) => o.key === d.outing)!;
    if (!boat || !boat.isActive || (boat.partner && !boat.partner.isActive)) return bad("not_found", 404);
    const price = boat[outing.field];
    if (price == null) return bad("invalid_input");
    label = `${boat.name} — ${t.outings[outing.key]}`;
    subject = `Boat requested: ${boat.name} (${getDict("en").account.concierge.outings[outing.key]})`;
    facts.push(`~${money(price, boat.partner?.currency ?? "EUR")}`);
    if (boat.partner) ownerLines.push(`${boat.partner.name}: ${contactLine(boat.partner)}`);
  } else {
    const offer = await prisma.chefOffer.findUnique({ where: { id: d.id }, include: { partner: true } });
    if (!offer || !offer.isActive || (offer.partner && !offer.partner.isActive)) return bad("not_found", 404);
    label = `${t.tabs.chef} — ${offer.name}`;
    subject = `Private chef requested: ${offer.name}`;
    if (offer.price != null) {
      const cur = offer.partner?.currency ?? "EUR";
      facts.push(
        offer.priceType === "per_person"
          ? `~${money(offer.price * d.guests, cur)} (${d.guests} × ${money(offer.price, cur)})`
          : `~${money(offer.price, cur)} ${getDict("fr").account.concierge.priceTypes[offer.priceType] ?? ""}`.trim()
      );
    }
    if (d.guests < offer.minimumGuests) facts.push(`sous le minimum de ${offer.minimumGuests} pers.`);
    if (offer.partner) ownerLines.push(`${offer.partner.name}: ${contactLine(offer.partner)}`);
  }

  // notes are for the owner, who reads the admin in French
  const notes = [time, `${d.guests} pers.`, ...facts]
    .filter(Boolean)
    .join(" · ");
  const item = await prisma.reservationExtra.create({
    data: {
      reservationId: r.id,
      extraId: null,
      label,
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      status: "requested",
      serviceDate: dateOrNull(d.date),
      notes: d.notes ? `${notes}\n${d.notes}` : notes,
      requestedByGuest: true,
    },
  });
  await notifyOwnerOfGuestUpdate(r.id, {
    subject,
    lines: [
      `${d.date}${time ? ` at ${time}` : ""} · ${d.guests} guest${d.guests > 1 ? "s" : ""}`,
      ...facts.map((f) => `Indicative: ${f}`),
      ...(d.notes ? [`Note: ${d.notes}`] : []),
      ...ownerLines,
      "Confirm or cancel it in the reservation (Extras).",
    ],
  });
  return NextResponse.json({ success: true, item: serializeReservationExtra(item) });
}
