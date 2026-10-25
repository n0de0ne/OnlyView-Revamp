import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { serializeReservationExtra } from "@/lib/extras";
import { liveConciergeWhere } from "@/lib/concierge-requests";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Concierge requests across stays — the "Demandes conciergerie" inbox.
 * `?scope=open` (default): unanswered, on stays still to come or under way;
 * `upcoming`: every request on those stays; `all`: everything, newest first.
 */
export const GET = adminRoute("viewer", async (req) => {
  const scope = req.nextUrl.searchParams.get("scope") ?? "open";
  const where =
    scope === "all"
      ? { kind: "concierge" }
      : scope === "upcoming"
        ? liveConciergeWhere()
        : { ...liveConciergeWhere(), status: "requested" };
  const items = await prisma.reservationExtra.findMany({
    where,
    orderBy:
      scope === "all"
        ? [{ createdAt: "desc" }]
        : [{ serviceDate: "asc" }, { serviceTime: "asc" }, { createdAt: "asc" }],
    take: 300,
    include: {
      place: { select: { slug: true, phone: true, bookingUrl: true } },
      reservation: {
        select: {
          id: true,
          clientName: true,
          startDate: true,
          endDate: true,
          status: true,
          agency: { select: { name: true } },
        },
      },
    },
  });
  return jsonOk({
    requests: items.map((i) => ({
      ...serializeReservationExtra(i, i.place?.slug ?? null),
      placePhone: i.place?.phone ?? null,
      placeBookingUrl: i.place?.bookingUrl ?? null,
      reservation: {
        id: i.reservation.id,
        clientName: i.reservation.clientName,
        startDate: toISODate(i.reservation.startDate),
        endDate: toISODate(i.reservation.endDate),
        status: i.reservation.status,
        agency: i.reservation.agency?.name ?? null,
      },
    })),
  });
});
