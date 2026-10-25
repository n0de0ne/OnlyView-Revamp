import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { renderEmail } from "@/lib/email-templates";
import { formatDate, todayISO } from "@/lib/dates";
import { siteUrl } from "@/lib/seo";
import { ownerNotifyEmail } from "@/lib/contact";
import { maxGuestsFor } from "@/lib/site-facts";
import { analyticsConfig, attributeBookingRequest, clientIp, dailyVisitorId, VISITOR_COOKIE } from "@/lib/analytics/collect";

export const dynamic = "force-dynamic";

const Body = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bedrooms: z.number().int().min(2).max(4),
  guests: z.number().int().min(1).max(8),
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  promoCode: z.string().max(50).optional().nullable(),
  locale: z.enum(["en", "fr"]).default("en"),
  quote: z.unknown().optional(),
  /** honeypot */
  website: z.string().max(0).optional(),
}).refine((b) => b.guests <= maxGuestsFor(b.bedrooms), { path: ["guests"] });

// naive in-memory rate limit (per runtime instance)
const hits = new Map<string, { count: number; at: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > 3600_000) {
    hits.set(ip, { count: 1, at: now });
    return false;
  }
  h.count += 1;
  return h.count > 8;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.path[0] === "guests");
    return NextResponse.json(
      { success: false, error: tooMany ? "too_many_guests" : "invalid_input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  if (d.endDate <= d.startDate || d.startDate < todayISO()) {
    return NextResponse.json({ success: false, error: "invalid_dates" }, { status: 400 });
  }

  const request = await prisma.bookingRequest.create({
    data: {
      startDate: new Date(`${d.startDate}T00:00:00Z`),
      endDate: new Date(`${d.endDate}T00:00:00Z`),
      bedrooms: d.bedrooms,
      guests: d.guests,
      name: d.name,
      email: d.email.toLowerCase(),
      phone: d.phone ?? null,
      message: d.message ?? null,
      promoCode: d.promoCode ?? null,
      language: d.locale,
      quoteJson: d.quote != null ? JSON.stringify(d.quote) : null,
    },
  });

  // which visit (and so which source) the request came from — Admin → Analytique
  try {
    const { useCookie } = await analyticsConfig();
    const visitorId = useCookie
      ? req.cookies.get(VISITOR_COOKIE)?.value
      : await dailyVisitorId(clientIp(req.headers), req.headers.get("user-agent") ?? "");
    await attributeBookingRequest(visitorId, request.id);
  } catch (e) {
    console.error("[analytics] booking attribution failed:", e instanceof Error ? e.message : e);
  }

  // notify admin
  const adminEmail = await ownerNotifyEmail();
  await sendMail({
    to: adminEmail,
    subject: `New booking request — ${d.name} · ${d.startDate} → ${d.endDate}`,
    templateSlug: "admin_booking_request",
    html: `<h2 style="margin-top:0">New booking request #${request.id}</h2>
<p><strong>${d.name}</strong> &lt;${d.email}&gt;${d.phone ? " · " + d.phone : ""}</p>
<p>${d.startDate} → ${d.endDate} · ${d.bedrooms} bedrooms · ${d.guests} guests</p>
${d.message ? `<p style="background:#f6f4ef;padding:12px;border-radius:8px;">${d.message.replace(/</g, "&lt;")}</p>` : ""}
<p><a href="${siteUrl("/admin/requests")}">Open in admin</a></p>`,
  });

  // acknowledge to the guest (wording: Admin → Textes du site → Emails)
  const locale = d.locale === "fr" ? "fr" : "en";
  const ack = await renderEmail("bookingRequestAck", locale, {
    name: d.name,
    checkIn: formatDate(d.startDate, locale),
    checkOut: formatDate(d.endDate, locale),
    bedrooms: d.bedrooms,
    guests: d.guests,
  });
  await sendMail({
    to: d.email,
    toName: d.name,
    templateSlug: "booking_request_ack",
    subject: ack.subject,
    html: ack.html,
  });

  return NextResponse.json({ success: true, id: request.id });
}
