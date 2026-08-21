import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { isRangeAvailable } from "@/lib/availability";
import {
  ReservationInput,
  computePersistedPricing,
  reservationData,
  getReservationFull,
  serializeReservation,
  afterSaveHooks,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = adminRoute<Ctx>("viewer", async (_req, { params }) => {
  const { id } = await params;
  const full = await getReservationFull(parseInt(id, 10));
  if (!full) return jsonError("not_found", 404);
  return jsonOk({ reservation: serializeReservation(full) });
});

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return jsonError("not_found", 404);

  const parsed = ReservationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  }
  const input = parsed.data;
  if (input.endDate <= input.startDate) return jsonError("invalid_dates");

  if (["option", "confirmed", "blocked"].includes(input.status)) {
    const free = await isRangeAvailable(input.startDate, input.endDate, id);
    if (!free) return jsonError("dates_conflict", 409);
  }

  const pricing = await computePersistedPricing(input);
  await prisma.$transaction([
    prisma.reservationPeriod.deleteMany({ where: { reservationId: id } }),
    prisma.reservation.update({
      where: { id },
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
    }),
  ]);

  await afterSaveHooks(id);
  await audit({
    action: "reservation_update",
    entityType: "reservation",
    entityId: id,
    userId: user.id,
    username: user.username,
  });

  const full = await getReservationFull(id);
  return jsonOk({ reservation: full ? serializeReservation(full) : null });
});

export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return jsonError("not_found", 404);

  await prisma.reservation.delete({ where: { id } });
  await audit({
    action: "reservation_delete",
    entityType: "reservation",
    entityId: id,
    details: { client: existing.clientName },
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
