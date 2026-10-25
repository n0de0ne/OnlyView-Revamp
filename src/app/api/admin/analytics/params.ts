import type { NextRequest } from "next/server";
import type { Period, SessionFilter } from "@/lib/analytics/report";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** St Barth "today" (UTC−4) */
const localToday = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

/** ?from=&to= (St Barth days, inclusive) — defaults to the last 30 days */
export function readPeriod(req: NextRequest): Period {
  const q = req.nextUrl.searchParams;
  const to = ISO.test(q.get("to") ?? "") ? q.get("to")! : localToday();
  let from = ISO.test(q.get("from") ?? "") ? q.get("from")! : "";
  if (!from || from > to) {
    const d = new Date(`${to}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

export function readSegment(req: NextRequest): SessionFilter {
  const q = req.nextUrl.searchParams;
  const s = (k: string) => q.get(k)?.trim().slice(0, 255) || null;
  return {
    channel: s("channel"),
    source: s("source"),
    country: s("country"),
    device: s("device"),
    page: s("page"),
    converted: q.get("converted") === "1",
    returning: q.get("returning") === "1",
  };
}
