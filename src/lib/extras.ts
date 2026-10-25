import type { Extra, ReservationExtra, ServicePartner } from "@prisma/client";
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

/**
 * What the guest owes the villa for extras: confirmed lines only — not
 * concierge requests nor what a provider bills the guest directly.
 */
export function confirmedExtrasTotal(
  items: Array<{ status: string; amount: number; kind?: string; paidToProvider?: boolean }>
): number {
  return items
    .filter((i) => i.status === "confirmed" && i.kind !== "concierge" && !i.paidToProvider)
    .reduce((s, i) => s + i.amount, 0);
}

/** "€50" / "$1,200" */
export const moneyIn = (n: number, currency: string) =>
  (currency === "EUR" ? "€" : "$") + (Math.round(n * 100) / 100).toLocaleString("en-US");

/** Price fields a stay line copies from a catalog item (its provider's currency, if any). */
export const providerTerms = (e: { partner?: Pick<ServicePartner, "currency"> | null; partnerId?: number | null }) =>
  e.partnerId && e.partner
    ? { currency: e.partner.currency, paidToProvider: true }
    : { currency: "USD", paidToProvider: false };

export function serializeExtra(e: Extra & { partner?: Pick<ServicePartner, "name" | "currency"> | null }) {
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
    partnerId: e.partnerId,
    partnerName: e.partner?.name ?? null,
    currency: e.partner && e.partnerId ? e.partner.currency : "USD",
    categoryEn: e.categoryEn,
    categoryFr: e.categoryFr,
    imageUrl: e.imageUrl,
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
    currency: i.currency,
    paidToProvider: i.paidToProvider,
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
