import { prisma } from "./db";
import { getLoyaltyConfig } from "./settings";

export type LoyaltyTier = "guest" | "silver" | "gold" | "platinum";

export const TIER_THRESHOLDS: Array<{ tier: LoyaltyTier; min: number }> = [
  { tier: "platinum", min: 3000 },
  { tier: "gold", min: 1500 },
  { tier: "silver", min: 500 },
  { tier: "guest", min: 0 },
];

export function tierFor(lifetimePoints: number): LoyaltyTier {
  return TIER_THRESHOLDS.find((t) => lifetimePoints >= t.min)!.tier;
}

export function nextTier(lifetimePoints: number): { tier: LoyaltyTier; missing: number } | null {
  const ordered = [...TIER_THRESHOLDS].sort((a, b) => a.min - b.min);
  for (const t of ordered) {
    if (t.min > lifetimePoints) return { tier: t.tier, missing: t.min - lifetimePoints };
  }
  return null;
}

export async function getOrCreateAccount(clientId: number) {
  return prisma.loyaltyAccount.upsert({
    where: { clientId },
    create: { clientId },
    update: {},
  });
}

/** Points earned for a paid amount (USD, HT). */
export async function pointsForAmount(amountUSD: number): Promise<number> {
  const cfg = await getLoyaltyConfig();
  return Math.max(0, Math.floor(amountUSD * cfg.earnPerDollar));
}

/**
 * Credit points for a fully-paid reservation — idempotent per reservation.
 */
export async function earnForReservation(reservationId: number): Promise<number> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation || !reservation.clientId) return 0;
  if (!reservation.balanceReceived) return 0;

  const account = await getOrCreateAccount(reservation.clientId);
  const existing = await prisma.loyaltyTransaction.findFirst({
    where: { reservationId, kind: "earn" },
  });
  if (existing) return 0;

  const points = await pointsForAmount(reservation.priceHT);
  if (points <= 0) return 0;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        kind: "earn",
        points,
        reason: `Stay ${reservation.startDate.toISOString().slice(0, 10)} → ${reservation.endDate.toISOString().slice(0, 10)}`,
        reservationId,
        createdBy: "system",
      },
    }),
    prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { increment: points },
        lifetimePoints: { increment: points },
      },
    }),
  ]);
  return points;
}

/** Manual adjustment from the admin (positive or negative). */
export async function adjustPoints(opts: {
  clientId: number;
  points: number;
  reason: string;
  by: string;
}) {
  const account = await getOrCreateAccount(opts.clientId);
  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        kind: "adjust",
        points: opts.points,
        reason: opts.reason,
        createdBy: opts.by,
      },
    }),
    prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        points: { increment: opts.points },
        lifetimePoints: { increment: Math.max(0, opts.points) },
      },
    }),
  ]);
}
