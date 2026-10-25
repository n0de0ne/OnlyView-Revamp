import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGuestClientId } from "@/lib/guest-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The guest has seen the owner's answers on this stay's concierge requests:
 * the portal stops highlighting them. Sent by the page once it is on screen
 * (not on render, so a prefetch never swallows the highlight).
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const clientId = await getGuestClientId();
  const id = parseInt((await params).id, 10);
  if (!clientId || !Number.isFinite(id)) return NextResponse.json({ success: false }, { status: 404 });
  await prisma.reservationExtra.updateMany({
    where: { reservationId: id, kind: "concierge", reservation: { clientId }, answeredAt: { not: null } },
    data: { guestSeenAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
