import "server-only";
import { prisma } from "./db";
import {
  toISODate,
  eachNight,
  nightsBetween,
  fromISODate,
  seasonRange,
  seasonDays,
  seasonMonths,
  seasonMonthIndex,
} from "./dates";

export interface MonthlyRow {
  month: string; // "2025-09" — seasons run September → August
  revenueHT: number;
  commissions: number;
  tax: number;
  net: number;
  nightsBooked: number;
  occupancy: number; // 0..1
  expensesEUR: number;
  cashIn: number; // payments received that month (USD)
}

const FREQ_MONTHS: Record<string, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  yearly: 12,
};

/** Expand recurring expense templates into concrete instances for a season. */
export function expandRecurring(
  templates: Array<{
    amount: number;
    frequency: string | null;
    date: Date;
    endDate: Date | null;
    paymentDay: number;
    category: string;
    description: string | null;
  }>,
  season: number
): Array<{ date: string; amount: number; category: string; description: string | null; recurring: true }> {
  const out: Array<{ date: string; amount: number; category: string; description: string | null; recurring: true }> = [];
  for (const t of templates) {
    const step = FREQ_MONTHS[t.frequency ?? "monthly"] ?? 1;
    const start = new Date(Date.UTC(t.date.getUTCFullYear(), t.date.getUTCMonth(), 1));
    for (const m of seasonMonths(season)) {
      const cur = new Date(Date.UTC(m.year, m.month - 1, Math.min(t.paymentDay, 28)));
      if (cur < start) continue;
      if (t.endDate && cur > t.endDate) continue;
      const monthsSince =
        (cur.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (cur.getUTCMonth() - start.getUTCMonth());
      if (monthsSince % step !== 0) continue;
      out.push({
        date: toISODate(cur),
        amount: t.amount,
        category: t.category,
        description: t.description,
        recurring: true,
      });
    }
  }
  return out;
}

/**
 * Full P&L / occupancy picture for one season (September → August).
 * `season` is the year the season starts in: 2025 = Sep 2025 → Aug 2026.
 */
export async function seasonStats(season: number): Promise<{
  season: number;
  months: MonthlyRow[];
  totals: {
    revenueHT: number;
    commissions: number;
    tax: number;
    net: number;
    expensesEUR: number;
    nightsBooked: number;
    occupancy: number;
    cashIn: number;
    reservations: number;
    averageStay: number;
    directShare: number;
  };
  sources: Array<{ name: string; count: number; revenue: number }>;
}> {
  const { start: seasonStart, end: seasonEnd } = seasonRange(season);

  const [reservations, payments, oneOffExpenses, recurringTemplates] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: "confirmed",
        startDate: { lt: fromISODate(seasonEnd) },
        endDate: { gt: fromISODate(seasonStart) },
      },
      include: { agency: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { receivedAt: { gte: fromISODate(seasonStart), lt: fromISODate(seasonEnd) } },
    }),
    prisma.expense.findMany({
      where: {
        isFixed: false,
        date: { gte: fromISODate(seasonStart), lt: fromISODate(seasonEnd) },
      },
    }),
    prisma.expense.findMany({ where: { isFixed: true } }),
  ]);

  const monthKeys = seasonMonths(season);
  const months: MonthlyRow[] = monthKeys.map((m) => ({
    month: m.key,
    revenueHT: 0,
    commissions: 0,
    tax: 0,
    net: 0,
    nightsBooked: 0,
    occupancy: 0,
    expensesEUR: 0,
    cashIn: 0,
  }));
  const indexOf = (iso: string) => seasonMonthIndex(iso.slice(0, 7));

  // Accrual: spread each reservation's HT evenly across its nights
  for (const r of reservations) {
    const start = toISODate(r.startDate);
    const end = toISODate(r.endDate);
    const nights = nightsBetween(start, end);
    if (nights <= 0) continue;
    const perNightHT = r.priceHT / nights;
    const perNightCommission = (r.priceTTC * (r.agencyFeePercent / 100)) / nights;
    const perNightTax = r.taxAmount / nights;
    for (const night of eachNight(start, end)) {
      if (night < seasonStart || night >= seasonEnd) continue;
      const m = indexOf(night);
      months[m].revenueHT += perNightHT;
      months[m].commissions += perNightCommission;
      months[m].tax += perNightTax;
      months[m].nightsBooked += 1;
    }
  }

  for (const p of payments) {
    months[indexOf(toISODate(p.receivedAt))].cashIn +=
      p.kind === "refund" ? -p.amount : p.amount;
  }

  const allExpenses = [
    ...oneOffExpenses.map((e) => ({ date: toISODate(e.date), amount: e.amount })),
    ...expandRecurring(recurringTemplates, season),
  ];
  for (const e of allExpenses) months[indexOf(e.date)].expensesEUR += e.amount;

  months.forEach((row, i) => {
    const { year, month } = monthKeys[i];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    row.revenueHT = Math.round(row.revenueHT);
    row.commissions = Math.round(row.commissions);
    row.tax = Math.round(row.tax);
    row.net = row.revenueHT - row.commissions;
    row.occupancy = Math.min(1, row.nightsBooked / daysInMonth);
    row.expensesEUR = Math.round(row.expensesEUR * 100) / 100;
    row.cashIn = Math.round(row.cashIn);
  });

  // "Reservations of the season" = stays starting within it
  const inSeasonReservations = reservations.filter(
    (r) => toISODate(r.startDate) >= seasonStart && toISODate(r.startDate) < seasonEnd
  );
  const directCount = inSeasonReservations.filter((r) => !r.agencyId).length;

  const sourcesMap = new Map<string, { count: number; revenue: number }>();
  for (const r of inSeasonReservations) {
    const name = r.agency?.name ?? "Direct";
    const cur = sourcesMap.get(name) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += r.priceHT;
    sourcesMap.set(name, cur);
  }

  const nightsBooked = months.reduce((s, m) => s + m.nightsBooked, 0);
  const totals = {
    revenueHT: months.reduce((s, m) => s + m.revenueHT, 0),
    commissions: months.reduce((s, m) => s + m.commissions, 0),
    tax: months.reduce((s, m) => s + m.tax, 0),
    net: months.reduce((s, m) => s + m.net, 0),
    expensesEUR: Math.round(months.reduce((s, m) => s + m.expensesEUR, 0) * 100) / 100,
    nightsBooked,
    occupancy: nightsBooked / seasonDays(season),
    cashIn: months.reduce((s, m) => s + m.cashIn, 0),
    reservations: inSeasonReservations.length,
    averageStay:
      inSeasonReservations.length > 0
        ? Math.round(
            (inSeasonReservations.reduce(
              (s, r) => s + nightsBetween(toISODate(r.startDate), toISODate(r.endDate)),
              0
            ) /
              inSeasonReservations.length) *
              10
          ) / 10
        : 0,
    directShare:
      inSeasonReservations.length > 0 ? directCount / inSeasonReservations.length : 0,
  };

  return {
    season,
    months,
    totals,
    sources: [...sourcesMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}
