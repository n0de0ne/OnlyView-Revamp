import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { ReservationExtraPatch, dateOrNull } from "@/lib/admin-schemas";
import { audit } from "@/lib/audit";
import { lineAmount, serializeReservationExtra } from "@/lib/extras";

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
  const updated = await prisma.reservationExtra.update({
    where: { id: item.id },
    data: {
      label: d.label,
      quantity,
      unitPrice,
      amount: lineAmount(quantity, unitPrice),
      status: d.status,
      serviceDate: d.serviceDate !== undefined ? dateOrNull(d.serviceDate) : undefined,
      notes: d.notes !== undefined ? (d.notes ?? null) : undefined,
    },
  });
  await audit({
    action: "reservation_extra_update",
    entityType: "reservation",
    entityId: item.reservationId,
    details: { label: updated.label, status: updated.status, amount: updated.amount },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ item: serializeReservationExtra(updated) });
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
