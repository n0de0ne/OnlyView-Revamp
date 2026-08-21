import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const status = req.nextUrl.searchParams.get("status");
  const requests = await prisma.bookingRequest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return jsonOk({
    requests: requests.map((r) => ({
      ...r,
      startDate: toISODate(r.startDate),
      endDate: toISODate(r.endDate),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      quote: r.quoteJson ? JSON.parse(r.quoteJson) : null,
      quoteJson: undefined,
    })),
  });
});
