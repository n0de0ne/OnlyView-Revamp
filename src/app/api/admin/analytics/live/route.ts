import { adminRoute, jsonOk } from "@/lib/admin-api";
import { liveVisitors } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => jsonOk({ live: await liveVisitors() }));
