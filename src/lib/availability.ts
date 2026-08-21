import { prisma } from "./db";
import { toISODate } from "./dates";

/** Statuses that block the calendar. */
export const BLOCKING_STATUSES = ["option", "confirmed", "blocked"];

export interface BookedRange {
  id: number;
  start: string; // ISO date, first night
  end: string; // ISO date, checkout day
  status: string;
}

export async function getBookedRanges(opts?: {
  from?: string;
  to?: string;
}): Promise<BookedRange[]> {
  const where: Record<string, unknown> = {
    status: { in: BLOCKING_STATUSES },
    isArchived: false,
  };
  if (opts?.from) where.endDate = { gt: new Date(`${opts.from}T00:00:00Z`) };
  if (opts?.to)
    where.startDate = { lt: new Date(`${opts.to}T00:00:00Z`) };

  const rows = await prisma.reservation.findMany({
    where,
    select: { id: true, startDate: true, endDate: true, status: true },
    orderBy: { startDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    start: toISODate(r.startDate),
    end: toISODate(r.endDate),
    status: r.status,
  }));
}

/**
 * A stay [start, end) conflicts with a reservation [s, e) when the night
 * ranges overlap — checkout day is free for a new arrival.
 */
export async function isRangeAvailable(
  start: string,
  end: string,
  excludeReservationId?: number
): Promise<boolean> {
  const conflict = await prisma.reservation.findFirst({
    where: {
      status: { in: BLOCKING_STATUSES },
      isArchived: false,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      startDate: { lt: new Date(`${end}T00:00:00Z`) },
      endDate: { gt: new Date(`${start}T00:00:00Z`) },
    },
    select: { id: true },
  });
  return conflict === null;
}
