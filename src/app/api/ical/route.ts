import { NextRequest, NextResponse } from "next/server";
import { getBookedRanges } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * iCal feed.
 *  - public (no token): anonymized Booked/On-hold events
 *  - private (?token=ICAL_TOKEN or admin session): client names included
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.ICAL_TOKEN;
  let isPrivate = Boolean(expected && token && token === expected);
  if (!isPrivate) {
    isPrivate = (await getSessionUser().catch(() => null)) != null;
  }

  const ranges = await getBookedRanges();
  let names = new Map<number, string>();
  if (isPrivate) {
    const rows = await prisma.reservation.findMany({
      where: { id: { in: ranges.map((r) => r.id) } },
      select: { id: true, clientName: true },
    });
    names = new Map(rows.map((r) => [r.id, r.clientName ?? "Reservation"]));
  }

  const fmt = (iso: string) => iso.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Villa ONLY VIEW//Reservation Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Villa ONLY VIEW",
  ];
  for (const r of ranges) {
    const summary = isPrivate
      ? `${r.status === "confirmed" ? "🔴" : "🟡"} ${names.get(r.id) ?? "Reservation"}`
      : r.status === "confirmed"
        ? "Booked"
        : "On Hold";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTAMP:${stamp}`,
      `UID:onlyview-${r.id}@onlyviewstbarth.com`,
      `DTSTART;VALUE=DATE:${fmt(r.start)}`,
      `DTEND;VALUE=DATE:${fmt(r.end)}`,
      `SUMMARY:${summary}`,
      `STATUS:${r.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="onlyview-calendar.ics"',
    },
  });
}
