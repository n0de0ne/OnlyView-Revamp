import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hourlyLimit, requestIp } from "@/lib/request-guard"; // night GN-508

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(100),
  country: z.string().max(100).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(10).max(2000),
  language: z.enum(["en", "fr"]).default("en"),
  website: z.string().max(0).optional(), // honeypot
});

/** night GN-508: as the booking form */
const rateLimited = hourlyLimit(8);

export async function POST(req: NextRequest) {
  if (rateLimited(requestIp(req.headers))) return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  await prisma.testimonial.create({
    data: {
      name: d.name,
      country: d.country ?? null,
      rating: d.rating,
      message: d.message,
      language: d.language,
      isApproved: false, // moderated in admin
    },
  });
  return NextResponse.json({ success: true });
}
