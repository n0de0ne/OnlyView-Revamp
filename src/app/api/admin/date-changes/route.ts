import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { serializeDateChange } from "@/lib/date-changes";

export const dynamic = "force-dynamic";

/** Guests' change-of-dates requests (pending first) — Requests inbox. */
export const GET = adminRoute("viewer", async (req) => {
  const status = req.nextUrl.searchParams.get("status");
  const rows = await prisma.dateChange.findMany({
    where: { source: "guest", ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { reservation: { select: { id: true, clientName: true, status: true } } },
  });
  return jsonOk({
    changes: rows.map((d) => ({
      ...serializeDateChange(d),
      reservation: d.reservation,
    })),
  });
});
