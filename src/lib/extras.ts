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

export function serializeReservationExtra(i: ReservationExtra) {
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
    createdAt: i.createdAt.toISOString(),
  };
}

export type SerializedReservationExtra = ReturnType<typeof serializeReservationExtra>;
