import { NextRequest, NextResponse } from "next/server";
import { getBookedRanges } from "@/lib/availability";

export const dynamic = "force-dynamic";

/** Public availability: date ranges + status only (no client data). */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  try {
    const ranges = await getBookedRanges({ from, to });
    return NextResponse.json(
      {
        success: true,
        bookings: ranges.map((r) => ({
          start: r.start,
          end: r.end,
          status: r.status === "confirmed" ? "confirmed" : "option",
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    return NextResponse.json({ success: true, bookings: [] });
  }
}
