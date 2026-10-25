import type { Extra, ReservationExtra } from "@prisma/client";
import { toISODate } from "./dates";

export type ExtraUnit = "stay" | "night" | "person" | "unit";

export const EXTRA_UNIT_LABELS: Record<ExtraUnit, { en: string; fr: string }> = {
  stay: { en: "per stay", fr: "par séjour" },
  night: { en: "per night", fr: "par nuit" },
  person: { en: "per person", fr: "par personne" },
  unit: { en: "each", fr: "l'unité" },
};

/** Sensible default quantity for a catalog item on a given stay. */
export function defaultQuantity(unit: string, stay: { nights: number; guests: number }): number {
  if (unit === "night") return Math.max(1, stay.nights);
  if (unit === "person") return Math.max(1, stay.guests);
  return 1;
}

export const lineAmount = (quantity: number, unitPrice: number) =>
  Math.round(quantity * unitPrice * 100) / 100;

/** Concierge requests are booked with the provider, not sold with the stay. */
export const isConcierge = (i: { kind: string }) => i.kind === "concierge";

/** What the guest owes for extras: confirmed lines only. */
export function confirmedExtrasTotal(items: Array<{ status: string; amount: number }>): number {
  return items.filter((i) => i.status === "confirmed").reduce((s, i) => s + i.amount, 0);
}

export function serializeExtra(e: Extra) {
  return {
    id: e.id,
    nameEn: e.nameEn,
    nameFr: e.nameFr,
    descriptionEn: e.descriptionEn,
    descriptionFr: e.descriptionFr,
    price: e.price,
    unit: e.unit,
    isActive: e.isActive,
    guestBookable: e.guestBookable,
    sortOrder: e.sortOrder,
  };
}

/** `placeSlug`: the map place of a table request, for its "Directions" link. */
export function serializeReservationExtra(i: ReservationExtra, placeSlug: string | null = null) {
  return {
    id: i.id,
    extraId: i.extraId,
    label: i.label,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
    status: i.status,
    serviceDate: i.serviceDate ? toISODate(i.serviceDate) : null,
    notes: i.notes,
    requestedByGuest: i.requestedByGuest,
    kind: i.kind,
    category: i.category,
    serviceTime: i.serviceTime,
    guests: i.guests,
    adminNote: i.adminNote,
    answeredAt: i.answeredAt?.toISOString() ?? null,
    placeSlug,
    createdAt: i.createdAt.toISOString(),
  };
}

export type SerializedReservationExtra = ReturnType<typeof serializeReservationExtra>;
