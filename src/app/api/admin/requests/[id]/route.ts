import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { toISODate } from "@/lib/dates";
import {
  computePersistedPricing,
  reservationData,
  ReservationInput,
} from "@/lib/reservations";
import { isRangeAvailable } from "@/lib/availability";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  action: z.enum(["set-status", "convert"]),
  status: z.enum(["new", "answered", "converted", "declined"]).optional(),
  adminNotes: z.string().max(4000).nullable().optional(),
  /** for convert */
  reservationStatus: z.enum(["option", "confirmed"]).default("option"),
  optionExpires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const request = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!request) return jsonError("not_found", 404);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const d = parsed.data;

  if (d.action === "set-status") {
    if (!d.status) return jsonError("missing_status");
    await prisma.bookingRequest.update({
      where: { id },
      data: { status: d.status, adminNotes: d.adminNotes ?? undefined },
    });
    await audit({
      action: "request_status",
      entityType: "booking_request",
      entityId: id,
      details: { status: d.status },
      userId: user.id,
      username: user.username,
    });
    return jsonOk();
  }

  // convert → create client (if needed) + reservation
  const startDate = toISODate(request.startDate);
  const endDate = toISODate(request.endDate);
  const free = await isRangeAvailable(startDate, endDate);
  if (!free) return jsonError("dates_conflict", 409);

  const [firstname, ...rest] = request.name.trim().split(/\s+/);
  const lastname = rest.join(" ") || "—";
  let client = await prisma.client.findUnique({ where: { email: request.email } });
  client ??= await prisma.client.create({
    data: {
      firstname,
      lastname,
      email: request.email,
      phone: request.phone,
      language: request.language,
      source: "website",
    },
  });

  const input = ReservationInput.parse({
    status: d.reservationStatus,
    startDate,
    endDate,
    clientId: client.id,
    clientName: request.name,
    email: request.email,
    phone: request.phone,
    bedrooms: request.bedrooms,
    guests: request.guests,
    promoCode: request.promoCode,
    optionExpires: d.optionExpires ?? null,
    notes: request.message,
  });
  const pricing = await computePersistedPricing(input);
  const reservation = await prisma.reservation.create({
    data: reservationData(input, pricing),
  });

  await prisma.bookingRequest.update({
    where: { id },
    data: { status: "converted", reservationId: reservation.id },
  });
  await audit({
    action: "request_converted",
    entityType: "booking_request",
    entityId: id,
    details: { reservationId: reservation.id },
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ reservationId: reservation.id });
});
