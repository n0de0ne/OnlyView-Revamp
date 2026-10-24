import { adminRoute, jsonOk } from "@/lib/admin-api";
import { visitJourneys } from "@/lib/analytics/report";
import { readPeriod, readSegment } from "../params";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("p") ?? "0", 10) || 0);
  return jsonOk(await visitJourneys(readPeriod(req), readSegment(req), page));
});
