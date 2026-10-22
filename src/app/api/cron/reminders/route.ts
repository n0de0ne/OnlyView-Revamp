import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Hourly reminder run. Called by the in-process scheduler (instrumentation)
 * with its own token, or by an external cron with CRON_TOKEN:
 *   curl -X POST -H "x-cron-token: $CRON_TOKEN" https://…/api/cron/reminders
 * Does nothing unless Réglages → Rappels automatiques is switched on.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cron-token") ?? "";
  const allowed = [process.env.CRON_TOKEN, process.env.REMINDERS_INTERNAL_TOKEN].filter(
    (t): t is string => !!t && t.length >= 16
  );
  if (!token || !allowed.some((t) => same(t, token))) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const preview = await runReminders({ dryRun: true });
  if (!preview.enabled) return NextResponse.json({ success: true, enabled: false, sent: 0 });
  const res = await runReminders();
  return NextResponse.json({ success: true, enabled: true, sent: res.actions.length });
}
