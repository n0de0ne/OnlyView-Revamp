import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guestEditableReservation, notifyOwnerOfGuestUpdate } from "@/lib/guest-stay";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Guest portal: withdraw a request the owner hasn't confirmed yet. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const r = await guestEditableReservation(parseInt(id, 10));
  if (!r) return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  const item = await prisma.reservationExtra.findUnique({ where: { id: parseInt(itemId, 10) } });
  if (!item || item.reservationId !== r.id || !item.requestedByGuest || item.status !== "requested") {
    return NextResponse.json({ success: false, error: "not_allowed" }, { status: 403 });
  }
  await prisma.reservationExtra.delete({ where: { id: item.id } });
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: `${item.kind === "concierge" ? "Concierge" : "Extra"} request withdrawn: ${item.label}`,
    lines: [
      item.kind === "concierge"
        ? [item.serviceDate?.toISOString().slice(0, 10), item.serviceTime, item.guests && `${item.guests} pers.`]
            .filter(Boolean)
            .join(" · ")
        : `${item.quantity} × ${item.label}`,
    ],
  });
  return NextResponse.json({ success: true });
}
