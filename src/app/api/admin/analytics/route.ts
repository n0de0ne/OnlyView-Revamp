import { adminRoute, jsonOk } from "@/lib/admin-api";
import { analyticsReport, attributedRequests, crawlerReport } from "@/lib/analytics/report";
import { readPeriod, readSegment } from "./params";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async (req) => {
  const period = readPeriod(req);
  const segment = readSegment(req);
  const [report, requests, crawlers] = await Promise.all([
    analyticsReport(period, segment),
    attributedRequests(period),
    crawlerReport(period),
  ]);
  return jsonOk({ report, requests, crawlers });
});
