import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ReservationExtraPatch, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { isConcierge, lineAmount, rentalDays, serializeReservationExtra } from "@/lib/extras";
import { ANSWERED_STATUSES, notifyGuestOfConciergeAnswer } from "@/lib/concierge-requests";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function findItem(params: Ctx["params"]) {
  const { id, itemId } = await params;
  const item = await prisma.reservationExtra.findUnique({ where: { id: parseInt(itemId, 10) } });
  return item && item.reservationId === parseInt(id, 10) ? item : null;
}

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const item = await findItem(params);
  if (!item) return jsonError("not_found", 404);
  const parsed = ReservationExtraPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input: " + parsed.error.issues[0]?.message);
  const d = parsed.data;
  const quantity = d.quantity ?? item.quantity;
  const unitPrice = d.unitPrice ?? item.unitPrice;
  // a rental keeps its day count, recomputed when its dates change
  const start = d.serviceDate !== undefined ? d.serviceDate : item.serviceDate?.toISOString().slice(0, 10) ?? null;
  const end =
    d.serviceEndDate !== undefined ? d.serviceEndDate : item.serviceEndDate?.toISOString().slice(0, 10) ?? null;
  const days = start && end && end >= start ? rentalDays(start, end) : null;
  // a concierge request is answered when its status or the owner's note changes
  const statusChanged = d.status !== undefined && d.status !== item.status;
  const noteChanged = d.adminNote !== undefined && (d.adminNote || null) !== item.adminNote;
  const answered = isConcierge(item) && (statusChanged || noteChanged);
  const updated = await prisma.reservationExtra.update({
    where: { id: item.id },
    data: {
      label: d.label,
      quantity,
      unitPrice,
      amount: lineAmount(quantity, unitPrice, days),
      days,
      serviceEndDate: d.serviceEndDate !== undefined ? dateOrNull(d.serviceEndDate) : undefined,
      status: d.status,
      serviceDate: d.serviceDate !== undefined ? dateOrNull(d.serviceDate) : undefined,
      notes: d.notes !== undefined ? (d.notes ?? null) : undefined,
      serviceTime: d.serviceTime !== undefined ? (d.serviceTime ?? null) : undefined,
      guests: d.guests !== undefined ? (d.guests ?? null) : undefined,
      adminNote: d.adminNote !== undefined ? (d.adminNote || null) : undefined,
      answeredAt: answered ? new Date() : undefined,
    },
  });
  let guestEmailed = false;
  if (
    answered &&
    d.notifyGuest !== false &&
    (ANSWERED_STATUSES as readonly string[]).includes(updated.status)
  ) {
    guestEmailed = await notifyGuestOfConciergeAnswer(updated.id);
  }
  await audit({
    action: "reservation_extra_update",
    entityType: "reservation",
    entityId: item.reservationId,
    details: { label: updated.label, status: updated.status, amount: updated.amount, guestEmailed },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ item: serializeReservationExtra(updated), guestEmailed });
});

export const DELETE = adminRoute<Ctx>("manager", async (_req, { params }, user) => {
  const item = await findItem(params);
  if (!item) return jsonError("not_found", 404);
  await prisma.reservationExtra.delete({ where: { id: item.id } });
  await audit({
    action: "reservation_extra_delete",
    entityType: "reservation",
    entityId: item.reservationId,
    details: { label: item.label },
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
