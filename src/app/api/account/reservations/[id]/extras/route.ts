import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { lineAmount, serializeReservationExtra } from "@/lib/extras";
import { guestEditableReservation, notifyOwnerOfGuestUpdate } from "@/lib/guest-stay";
import { dateOrNull } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  extraId: z.number().int().positive(),
  quantity: z.number().min(1).max(100).default(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  locale: z.enum(["en", "fr"]).default("en"),
});

/** Guest portal: request an extra from the catalog — the owner confirms it. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  const extra = await prisma.extra.findUnique({ where: { id: d.extraId } });
  if (!extra || !extra.isActive || !extra.guestBookable) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  const item = await prisma.reservationExtra.create({
    data: {
      reservationId: r.id,
      extraId: extra.id,
      label: d.locale === "fr" ? extra.nameFr : extra.nameEn,
      quantity: d.quantity,
      unitPrice: extra.price,
      amount: lineAmount(d.quantity, extra.price),
      status: "requested",
      serviceDate: dateOrNull(d.serviceDate),
      notes: d.notes || null,
      requestedByGuest: true,
    },
  });
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: `Extra requested: ${extra.nameEn}`,
    lines: [
      `${d.quantity} × ${extra.nameEn}${extra.price > 0 ? ` · $${item.amount}` : " · price on request"}`,
      ...(d.serviceDate ? [`Wanted on ${d.serviceDate}`] : []),
      ...(d.notes ? [`Note: ${d.notes}`] : []),
      "Confirm or cancel it in the reservation (Extras).",
    ],
  });
  return NextResponse.json({ success: true, item: serializeReservationExtra(item) });
}
