import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ReservationExtraInput, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { lineAmount, providerTerms, serializeReservationExtra } from "@/lib/extras";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const reservationId = parseInt((await params).id, 10);
  const exists = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { id: true } });
  if (!exists) return jsonError("not_found", 404);
  const parsed = ReservationExtraInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  const d = parsed.data;
  // a catalog item from a rental company keeps its currency and is paid to it
  const from = d.extraId
    ? await prisma.extra.findUnique({ where: { id: d.extraId }, include: { partner: true } })
    : null;
  const item = await prisma.reservationExtra.create({
    data: {
      reservationId,
      extraId: d.extraId ?? null,
      label: d.label,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      amount: lineAmount(d.quantity, d.unitPrice),
      status: d.status,
      serviceDate: dateOrNull(d.serviceDate),
      notes: d.notes ?? null,
      ...providerTerms(from ?? {}),
    },
  });
  await audit({
    action: "reservation_extra_add",
    entityType: "reservation",
    entityId: reservationId,
    details: { label: d.label, amount: item.amount },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ item: serializeReservationExtra(item) });
});
