import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guestEditableReservation, notifyOwnerOfGuestUpdate } from "@/lib/guest-stay";
import { checkNewDates, serializeDateChange } from "@/lib/date-changes";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  message: z.string().trim().max(2000).nullable().optional(),
  /** only check availability and price, nothing is sent */
  preview: z.boolean().default(false),
});

const fail = (error: string, status = 400) =>
  NextResponse.json({ success: false, error }, { status });

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Guest portal: ask to move the stay — the owner approves or rejects it. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const id = parseInt((await params).id, 10);
  const r = await guestEditableReservation(id);
  if (!r) return fail("not_found", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input");
  const d = parsed.data;

  const periods = await prisma.reservationPeriod.findMany({ where: { reservationId: r.id } });
  const check = await checkNewDates({ ...r, periods }, d.startDate, d.endDate);
  if (!check.ok) return fail(check.error, check.error === "dates_unavailable" ? 409 : 400);
  if (d.preview) {
    return NextResponse.json({ success: true, preview: check, currentTTC: r.priceTTC });
  }

  const pending = await prisma.dateChange.findFirst({
    where: { reservationId: r.id, status: "pending" },
  });
  if (pending) return fail("already_pending", 409);

  const change = await prisma.dateChange.create({
    data: {
      reservationId: r.id,
      source: "guest",
      status: "pending",
      fromStart: r.startDate,
      fromEnd: r.endDate,
      toStart: new Date(`${d.startDate}T00:00:00Z`),
      toEnd: new Date(`${d.endDate}T00:00:00Z`),
      previousTTC: r.priceTTC,
      quotedTTC: check.quotedTTC,
      message: d.message || null,
    },
  });
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: "Change of dates requested",
    lines: [
      `Current: ${toISODate(r.startDate)} → ${toISODate(r.endDate)} · ${usd(r.priceTTC)}`,
      `Requested: ${d.startDate} → ${d.endDate} (${check.nights} nights)` +
        (check.quotedTTC != null ? ` · estimated ${usd(check.quotedTTC)}` : " · price to set by hand"),
      ...(check.minStayOk ? [] : [`Below the ${check.minStayRequired}-night minimum stay`]),
      ...(d.message ? [`Message: ${d.message}`] : []),
      "Approve or reject it in the reservation: approving issues the amendment to sign.",
    ],
  });
  return NextResponse.json({ success: true, change: serializeDateChange(change) });
}

/** Withdraw a request the owner hasn't answered yet. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return fail("not_found", 404);
  const res = await prisma.dateChange.updateMany({
    where: { reservationId: r.id, status: "pending", source: "guest" },
    data: { status: "cancelled", decidedAt: new Date() },
  });
  if (!res.count) return fail("not_found", 404);
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: "Change of dates withdrawn",
    lines: ["The guest withdrew their change-of-dates request."],
  });
  return NextResponse.json({ success: true });
}
