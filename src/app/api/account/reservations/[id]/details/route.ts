import { NextRequest, NextResponse } from "next/server";
import { GuestDetailsInput } from "@/lib/admin-schemas";
import { guestEditableReservation, notifyOwnerOfGuestUpdate, saveGuestDetails } from "@/lib/guest-stay";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Guest portal: arrival flights, times, party and special requests. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await guestEditableReservation(parseInt((await params).id, 10));
  if (!r) return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  const parsed = GuestDetailsInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  await saveGuestDetails(r.id, d);
  await notifyOwnerOfGuestUpdate(r.id, {
    subject: "Arrival details updated",
    lines: [
      `Arrival: ${d.arrivalFlight || "—"} · ${d.arrivalEta || "—"}`,
      `Departure: ${d.departureFlight || "—"} · ${d.departureEta || "—"}`,
      `Party: ${d.adults ?? "—"} adults, ${d.children ?? "—"} children`,
      ...(d.guestNames ? [`Guests: ${d.guestNames.replace(/\s*\n\s*/g, ", ")}`] : []),
      ...(d.specialRequests ? [`Requests: ${d.specialRequests}`] : []),
    ],
  });
  return NextResponse.json({ success: true });
}
