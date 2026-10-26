import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncProviderExtras } from "@/lib/extras-sync";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * St Barth Provider catalog sync, for an external cron (the server already
 * runs it daily by itself, see instrumentation):
 *   curl -X POST -H "x-cron-token: $CRON_TOKEN" https://…/api/cron/extras-sync
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cron-token") ?? "";
  const expected = process.env.CRON_TOKEN;
  if (!token || !expected || expected.length < 16 || !same(expected, token)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const status = await syncProviderExtras();
  return NextResponse.json({ success: status.ok, status });
}
