import "server-only";
import { prisma } from "./db";
import { toISODate, eachNight, nightsBetween } from "./dates";

export interface MonthlyRow {
  month: string; // "2026-01"
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

/** Expand recurring expense templates into concrete monthly instances for a year. */
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
  year: number
): Array<{ date: string; amount: number; category: string; description: string | null; recurring: true }> {
  const out: Array<{ date: string; amount: number; category: string; description: string | null; recurring: true }> = [];
  for (const t of templates) {
    const step = FREQ_MONTHS[t.frequency ?? "monthly"] ?? 1;
    const start = new Date(Date.UTC(t.date.getUTCFullYear(), t.date.getUTCMonth(), 1));
    for (let m = 0; m < 12; m += 1) {
      const cur = new Date(Date.UTC(year, m, Math.min(t.paymentDay, 28)));
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

export async function yearStats(year: number): Promise<{
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
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const [reservations, payments, oneOffExpenses, recurringTemplates] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: "confirmed",
        startDate: { lt: new Date(`${yearEnd}T00:00:00Z`) },
        endDate: { gt: new Date(`${yearStart}T00:00:00Z`) },
      },
      include: { agency: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: {
        receivedAt: {
          gte: new Date(`${yearStart}T00:00:00Z`),
          lt: new Date(`${yearEnd}T00:00:00Z`),
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        isFixed: false,
        date: {
          gte: new Date(`${yearStart}T00:00:00Z`),
          lt: new Date(`${yearEnd}T00:00:00Z`),
        },
      },
    }),
    prisma.expense.findMany({ where: { isFixed: true } }),
  ]);

  const months: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    revenueHT: 0,
    commissions: 0,
    tax: 0,
    net: 0,
    nightsBooked: 0,
    occupancy: 0,
    expensesEUR: 0,
    cashIn: 0,
  }));

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
      if (night < yearStart || night >= yearEnd) continue;
      const m = parseInt(night.slice(5, 7), 10) - 1;
      months[m].revenueHT += perNightHT;
      months[m].commissions += perNightCommission;
      months[m].tax += perNightTax;
      months[m].nightsBooked += 1;
    }
  }

  for (const p of payments) {
    const m = p.receivedAt.getUTCMonth();
    months[m].cashIn += p.kind === "refund" ? -p.amount : p.amount;
  }

  const allExpenses = [
    ...oneOffExpenses.map((e) => ({ date: toISODate(e.date), amount: e.amount })),
    ...expandRecurring(recurringTemplates, year),
  ];
  for (const e of allExpenses) {
    const m = parseInt(e.date.slice(5, 7), 10) - 1;
    months[m].expensesEUR += e.amount;
  }

  const daysInMonth = (m: number) => new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  months.forEach((row, i) => {
    row.revenueHT = Math.round(row.revenueHT);
    row.commissions = Math.round(row.commissions);
    row.tax = Math.round(row.tax);
    row.net = row.revenueHT - row.commissions;
    row.occupancy = Math.min(1, row.nightsBooked / daysInMonth(i));
    row.expensesEUR = Math.round(row.expensesEUR * 100) / 100;
    row.cashIn = Math.round(row.cashIn);
  });

  const inYearReservations = reservations.filter(
    (r) => toISODate(r.startDate) >= yearStart && toISODate(r.startDate) < yearEnd
  );
  const directCount = inYearReservations.filter((r) => !r.agencyId).length;

  const sourcesMap = new Map<string, { count: number; revenue: number }>();
  for (const r of inYearReservations) {
    const name = r.agency?.name ?? "Direct";
    const cur = sourcesMap.get(name) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += r.priceHT;
    sourcesMap.set(name, cur);
  }

  const totals = {
    revenueHT: months.reduce((s, m) => s + m.revenueHT, 0),
    commissions: months.reduce((s, m) => s + m.commissions, 0),
    tax: months.reduce((s, m) => s + m.tax, 0),
    net: months.reduce((s, m) => s + m.net, 0),
    expensesEUR: Math.round(months.reduce((s, m) => s + m.expensesEUR, 0) * 100) / 100,
    nightsBooked: months.reduce((s, m) => s + m.nightsBooked, 0),
    occupancy:
      months.reduce((s, m) => s + m.nightsBooked, 0) /
      (365 + (year % 4 === 0 ? 1 : 0)),
    cashIn: months.reduce((s, m) => s + m.cashIn, 0),
    reservations: inYearReservations.length,
    averageStay:
      inYearReservations.length > 0
        ? Math.round(
            (inYearReservations.reduce(
              (s, r) => s + nightsBetween(toISODate(r.startDate), toISODate(r.endDate)),
              0
            ) /
              inYearReservations.length) *
              10
          ) / 10
        : 0,
    directShare:
      inYearReservations.length > 0 ? directCount / inYearReservations.length : 0,
  };

  return {
    months,
    totals,
    sources: [...sourcesMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}
