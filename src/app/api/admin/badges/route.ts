import { prisma } from "@/lib/db";
import { adminRoute, jsonOk } from "@/lib/admin-api";
import { pendingConciergeCount } from "@/lib/concierge-requests";

export const dynamic = "force-dynamic";

/** Counts behind the admin menu badges: what is waiting for an answer. */
export const GET = adminRoute("viewer", async () => {
  const [bookingRequests, dateChanges, concierge] = await Promise.all([
    prisma.bookingRequest.count({ where: { status: "new" } }),
    prisma.dateChange.count({ where: { status: "pending" } }),
    pendingConciergeCount(),
  ]);
  return jsonOk({ requests: bookingRequests + dateChanges, concierge });
});
