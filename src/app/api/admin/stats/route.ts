import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { yearStats } from "@/lib/stats";
import { toISODate, todayISO, addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year =
    yearParam && /^\d{4}$/.test(yearParam)
      ? parseInt(yearParam, 10)
      : new Date().getUTCFullYear();

  const today = todayISO();
  const [stats, upcoming, pendingRequests, expiringOptions, pendingContracts] =
    await Promise.all([
      yearStats(year),
      prisma.reservation.findMany({
        where: {
          status: "confirmed",
          isArchived: false,
          startDate: { gte: new Date(`${today}T00:00:00Z`) },
        },
        orderBy: { startDate: "asc" },
        take: 5,
        select: {
          id: true,
          clientName: true,
          startDate: true,
          endDate: true,
          guests: true,
          bedrooms: true,
          priceTTC: true,
          balanceReceived: true,
          depositReceived: true,
        },
      }),
      prisma.bookingRequest.count({ where: { status: "new" } }),
      prisma.reservation.findMany({
        where: {
          status: "option",
          isArchived: false,
          optionExpires: { lte: new Date(`${addDays(today, 7)}T00:00:00Z`) },
        },
        select: { id: true, clientName: true, optionExpires: true, startDate: true },
      }),
      prisma.contract.count({ where: { status: "pending" } }),
    ]);

  return jsonOk({
    year,
    ...stats,
    upcoming: upcoming.map((r) => ({
      ...r,
      startDate: toISODate(r.startDate),
      endDate: toISODate(r.endDate),
    })),
    pendingRequests,
    pendingContracts,
    expiringOptions: expiringOptions.map((r) => ({
      ...r,
      startDate: toISODate(r.startDate),
      optionExpires: r.optionExpires ? toISODate(r.optionExpires) : null,
    })),
  });
});
