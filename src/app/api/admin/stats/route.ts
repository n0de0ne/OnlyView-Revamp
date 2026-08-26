import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { seasonStats } from "@/lib/stats";
import { toISODate, todayISO, addDays, currentSeason } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  // A season is named after the year it starts in (Sept → Aug).
  const seasonParam = req.nextUrl.searchParams.get("season");
  const season =
    seasonParam && /^\d{4}$/.test(seasonParam)
      ? parseInt(seasonParam, 10)
      : currentSeason();

  const today = todayISO();
  const [stats, upcoming, pendingRequests, expiringOptions, pendingContracts] =
    await Promise.all([
      seasonStats(season),
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
