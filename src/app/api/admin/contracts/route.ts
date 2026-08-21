import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      reservation: {
        select: { id: true, startDate: true, endDate: true, status: true },
      },
    },
  });
  return jsonOk({
    contracts: contracts.map((c) => ({
      id: c.id,
      token: c.token,
      status: c.status,
      language: c.language,
      clientName: c.clientName,
      clientEmail: c.clientEmail,
      totalPrice: c.totalPrice,
      depositAmount: c.depositAmount,
      signedAt: c.signedAt?.toISOString() ?? null,
      viewCount: c.viewCount,
      firstViewedAt: c.firstViewedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt?.toISOString() ?? null,
      reservation: {
        id: c.reservation.id,
        startDate: toISODate(c.reservation.startDate),
        endDate: toISODate(c.reservation.endDate),
        status: c.reservation.status,
      },
    })),
  });
});
