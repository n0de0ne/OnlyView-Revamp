import "server-only";
import { z } from "zod";
import { prisma } from "./db";
import { computeQuote, type PeriodInput } from "./pricing";
import { getRateConfig } from "./settings";
import { toISODate } from "./dates";
import { earnForReservation } from "./loyalty";

export const RESERVATION_STATUSES = [
  "option",
  "confirmed",
  "pending",
  "cancelled",
  "blocked",
] as const;

export const ReservationInput = z.object({
  status: z.enum(RESERVATION_STATUSES).default("option"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientId: z.number().int().positive().nullable().optional(),
  clientName: z.string().max(200).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(50).nullable().optional(),
  bedrooms: z.number().int().min(1).max(4).default(4),
  guests: z.number().int().min(1).max(8).default(8),
  agencyId: z.number().int().positive().nullable().optional(),
  agencyFeePercent: z.number().min(0).max(100).default(0),
  customWeeklyRate: z.number().min(0).nullable().optional(),
  finalPriceOverride: z.number().min(0).nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  offerOneRoom: z.boolean().default(false),
  freeNights: z.number().int().min(0).max(30).default(0),
  noTax: z.boolean().default(false),
  promoCode: z.string().max(50).nullable().optional(),
  optionExpires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(),
  depositReceived: z.boolean().default(false),
  balanceReceived: z.boolean().default(false),
  earlyCheckin: z.boolean().default(false),
  arrivalTime: z.string().max(20).nullable().optional(),
  lateCheckout: z.boolean().default(false),
  departureTime: z.string().max(20).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  /** send the booking confirmation email to the client when saving as confirmed */
  sendConfirmationEmail: z.boolean().default(false),
  periods: z
    .array(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        bedrooms: z.number().int().min(1).max(4),
        weeklyRate: z.number().min(0).nullable().optional(),
      })
    )
    .default([]),
});

export type ReservationInputType = z.infer<typeof ReservationInput>;

/** Recompute persisted pricing from the input using the live rate config. */
export async function computePersistedPricing(input: ReservationInputType) {
  const rates = await getRateConfig();
  const quote = computeQuote(
    {
      startDate: input.startDate,
      endDate: input.endDate,
      bedrooms: input.bedrooms,
      periods: input.periods as PeriodInput[],
      customWeeklyRate: input.customWeeklyRate,
      offerOneRoom: input.offerOneRoom,
      freeNights: input.freeNights,
      discountPercent: input.discountPercent,
      finalPriceOverride: input.finalPriceOverride,
      noTax: input.noTax,
      agencyFeePercent: input.agencyFeePercent,
    },
    rates
  );
  return {
    priceHT: quote.finalHT,
    taxAmount: quote.taxAmount,
    priceTTC: quote.totalTTC,
    computedDeposit: quote.depositAmount,
  };
}

export function reservationData(input: ReservationInputType, pricing: {
  priceHT: number;
  taxAmount: number;
  priceTTC: number;
  computedDeposit: number;
}) {
  return {
    status: input.status,
    startDate: new Date(`${input.startDate}T00:00:00Z`),
    endDate: new Date(`${input.endDate}T00:00:00Z`),
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    bedrooms: input.bedrooms,
    guests: input.guests,
    agencyId: input.agencyId ?? null,
    agencyFeePercent: input.agencyFeePercent,
    customWeeklyRate: input.customWeeklyRate ?? null,
    finalPriceOverride: input.finalPriceOverride ?? null,
    priceHT: pricing.priceHT,
    taxAmount: pricing.taxAmount,
    priceTTC: pricing.priceTTC,
    discountPercent: input.discountPercent,
    offerOneRoom: input.offerOneRoom,
    freeNights: input.freeNights,
    noTax: input.noTax,
    promoCode: input.promoCode ?? null,
    optionExpires: input.optionExpires ? new Date(`${input.optionExpires}T00:00:00Z`) : null,
    depositAmount: input.depositAmount ?? pricing.computedDeposit,
    depositReceived: input.depositReceived,
    balanceReceived: input.balanceReceived,
    earlyCheckin: input.earlyCheckin,
    arrivalTime: input.arrivalTime ?? null,
    lateCheckout: input.lateCheckout,
    departureTime: input.departureTime ?? null,
    notes: input.notes ?? null,
  };
}

const include = {
  client: { select: { id: true, firstname: true, lastname: true, email: true, phone: true, isVip: true, blacklisted: true, discountPercent: true, discountReason: true } },
  agency: { select: { id: true, name: true, commissionPercent: true } },
  periods: { orderBy: { sortOrder: "asc" as const } },
  payments: { orderBy: { receivedAt: "asc" as const } },
  contracts: { orderBy: { createdAt: "desc" as const } },
} as const;

export type ReservationWithRelations = NonNullable<
  Awaited<ReturnType<typeof getReservationFull>>
>;

export function getReservationFull(id: number) {
  return prisma.reservation.findUnique({ where: { id }, include });
}

export function listReservationsFull(where: Record<string, unknown>) {
  return prisma.reservation.findMany({
    where,
    include,
    orderBy: { startDate: "asc" },
  });
}

export function serializeReservation(r: ReservationWithRelations) {
  return {
    id: r.id,
    status: r.status,
    startDate: toISODate(r.startDate),
    endDate: toISODate(r.endDate),
    clientId: r.clientId,
    clientName: r.clientName,
    email: r.email,
    phone: r.phone,
    client: r.client,
    bedrooms: r.bedrooms,
    guests: r.guests,
    agencyId: r.agencyId,
    agency: r.agency,
    agencyFeePercent: r.agencyFeePercent,
    customWeeklyRate: r.customWeeklyRate,
    finalPriceOverride: r.finalPriceOverride,
    priceHT: r.priceHT,
    taxAmount: r.taxAmount,
    priceTTC: r.priceTTC,
    discountPercent: r.discountPercent,
    offerOneRoom: r.offerOneRoom,
    freeNights: r.freeNights,
    noTax: r.noTax,
    promoCode: r.promoCode,
    optionExpires: r.optionExpires ? toISODate(r.optionExpires) : null,
    depositAmount: r.depositAmount,
    depositReceived: r.depositReceived,
    balanceReceived: r.balanceReceived,
    earlyCheckin: r.earlyCheckin,
    arrivalTime: r.arrivalTime,
    lateCheckout: r.lateCheckout,
    departureTime: r.departureTime,
    notes: r.notes,
    portalToken: r.portalToken,
    isArchived: r.isArchived,
    confirmationEmailSent: r.confirmationEmailSent,
    periods: r.periods.map((p) => ({
      id: p.id,
      startDate: toISODate(p.startDate),
      endDate: toISODate(p.endDate),
      bedrooms: p.bedrooms,
      weeklyRate: p.weeklyRate,
    })),
    payments: r.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      amount: p.amount,
      method: p.method,
      receivedAt: toISODate(p.receivedAt),
      notes: p.notes,
    })),
    contracts: r.contracts.map((c) => ({
      id: c.id,
      token: c.token,
      status: c.status,
      language: c.language,
      totalPrice: c.totalPrice,
      signedAt: c.signedAt?.toISOString() ?? null,
      viewCount: c.viewCount,
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt?.toISOString() ?? null,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type SerializedReservation = ReturnType<typeof serializeReservation>;

/** Sync payment ledger rollups + loyalty when a reservation is saved. */
export async function afterSaveHooks(reservationId: number) {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!r) return;
  if (r.balanceReceived && r.clientId && r.status === "confirmed") {
    await earnForReservation(reservationId);
  }
}
