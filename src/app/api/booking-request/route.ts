import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { renderEmail } from "@/lib/email-templates";
import { formatDate, todayISO } from "@/lib/dates";
import { siteUrl } from "@/lib/seo";
import { ownerNotifyEmail } from "@/lib/contact";
import { maxGuestsFor } from "@/lib/site-facts";
import { esc, hourlyLimit, oneLine, realDay, requestIp } from "@/lib/request-guard"; // night GN-507/508/509
import { analyticsConfig, attributeBookingRequest, clientIp, dailyVisitorId, VISITOR_COOKIE } from "@/lib/analytics/collect";

export const dynamic = "force-dynamic";

const Body = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDay),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDay),
  bedrooms: z.number().int().min(2).max(4),
  guests: z.number().int().min(1).max(8),
  name: z.string().trim().min(2).max(120).refine(oneLine),
  email: z.string().email().max(200),
  phone: z.string().max(50).refine(oneLine).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  promoCode: z.string().max(50).optional().nullable(),
  locale: z.enum(["en", "fr"]).default("en"),
  quote: z.unknown().optional(),
  /** honeypot */
  website: z.string().max(0).optional(),
}).refine((b) => b.guests <= maxGuestsFor(b.bedrooms), { path: ["guests"] });

// naive in-memory rate limits (per runtime instance)
const rateLimited = hourlyLimit(8);
/** night GN-508: the acknowledgement goes to a typed address: a few an hour per address at most */
const ackLimited = hourlyLimit(3);

export async function POST(req: NextRequest) {
  const ip = requestIp(req.headers); // night GN-508: not the first X-Forwarded-For entry, which the client writes
  if (rateLimited(ip)) {
    return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // night GN-509: « too many guests » only for the party-size rule, not a wrong type or bedroom count
    const tooMany = parsed.error.issues.every((i) => i.code === "custom" && i.path[0] === "guests");
    return NextResponse.json(
      { success: false, error: tooMany ? "too_many_guests" : "invalid_input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  // night GN-509: up to two years ahead, sixty nights at most
  const nights = (Date.parse(d.endDate) - Date.parse(d.startDate)) / 86_400_000;
  const horizon = new Date(Date.now() + 2 * 366 * 86_400_000).toISOString().slice(0, 10);
  if (d.endDate <= d.startDate || d.startDate < todayISO() || d.startDate > horizon || nights > 60) {
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
    // night GN-507: every typed field escaped (a name could be a live link from the site's own sender)
    html: `<h2 style="margin-top:0">New booking request #${request.id}</h2>
<p><strong>${esc(d.name)}</strong> &lt;${esc(d.email)}&gt;${d.phone ? " · " + esc(d.phone) : ""}</p>
<p>${esc(d.startDate)} → ${esc(d.endDate)} · ${d.bedrooms} bedrooms · ${d.guests} guests</p>
${d.message ? `<p style="background:#f6f4ef;padding:12px;border-radius:8px;white-space:pre-wrap;">${esc(d.message)}</p>` : ""}
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
  if (!ackLimited(d.email.toLowerCase())) await sendMail({
    to: d.email,
    toName: d.name,
    templateSlug: "booking_request_ack",
    subject: ack.subject,
    html: ack.html,
  });

  return NextResponse.json({ success: true, id: request.id });
}
