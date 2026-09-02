import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { isRangeAvailable } from "@/lib/availability";
import { fromISODate, seasonRange } from "@/lib/dates";
import { sendBookingConfirmation } from "@/lib/booking-emails";
import {
  ReservationInput,
  computePersistedPricing,
  reservationData,
  listReservationsFull,
  getReservationFull,
  serializeReservation,
  afterSaveHooks,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const sp = req.nextUrl.searchParams;
  const season = sp.get("season");
  const archived = sp.get("archived");
  const status = sp.get("status");

  const where: Record<string, unknown> = {};
  if (archived === "1") where.isArchived = true;
  else if (archived !== "all") where.isArchived = false;
  if (status) where.status = status;
  // Seasons run September → August; a stay belongs to every season it overlaps.
  if (season && /^\d{4}$/.test(season)) {
    const { start, end } = seasonRange(parseInt(season, 10));
    where.AND = [
      { startDate: { lt: fromISODate(end) } },
      { endDate: { gt: fromISODate(start) } },
    ];
  }

  const rows = await listReservationsFull(where);
  return jsonOk({ reservations: rows.map(serializeReservation) });
});

export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = ReservationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  }
  const input = parsed.data;
  if (input.endDate <= input.startDate) return jsonError("invalid_dates");

  if (["option", "confirmed", "blocked"].includes(input.status)) {
    const free = await isRangeAvailable(input.startDate, input.endDate);
    if (!free) return jsonError("dates_conflict", 409);
  }

  const pricing = await computePersistedPricing(input);
  const created = await prisma.reservation.create({
    data: {
      ...reservationData(input, pricing),
      periods: {
        create: input.periods.map((p, i) => ({
          startDate: new Date(`${p.startDate}T00:00:00Z`),
          endDate: new Date(`${p.endDate}T00:00:00Z`),
          bedrooms: p.bedrooms,
          weeklyRate: p.weeklyRate ?? null,
          sortOrder: i,
        })),
      },
    },
  });

  await afterSaveHooks(created.id);
  if (input.sendConfirmationEmail && input.status === "confirmed") {
    await sendBookingConfirmation(created.id);
  }
  await audit({
    action: "reservation_create",
    entityType: "reservation",
    entityId: created.id,
    details: { client: input.clientName, dates: `${input.startDate} → ${input.endDate}` },
    userId: user.id,
    username: user.username,
  });

  const full = await getReservationFull(created.id);
  return jsonOk({ reservation: full ? serializeReservation(full) : null });
});
