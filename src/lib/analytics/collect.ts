import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";
import { classify, referrerHost } from "./channels";
import { lookupGeo } from "./geo";
import { parseUA } from "./ua";

/** a visit ends after 30 minutes without activity */
export const SESSION_GAP_MS = 30 * 60_000;
/** raw rows are kept 25 months (CNIL audience-measurement guidance) */
export const RETENTION_MONTHS = 25;
export const VISITOR_COOKIE = "ov_vid";
export const OPTOUT_COOKIE = "ov_optout";
/** 13 months, never extended (CNIL) */
export const VISITOR_COOKIE_MAX_AGE = 395 * 86_400;

export function clientIp(h: Headers): string | null {
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    null
  );
}

let saltCache: string | null = null;
async function salt(): Promise<string> {
  if (saltCache) return saltCache;
  const s = await getSettings();
  if (s.analytics_salt) return (saltCache = s.analytics_salt);
  const fresh = randomBytes(24).toString("hex");
  await setSetting("analytics_salt", fresh);
  return (saltCache = fresh);
}

/**
 * Visitor id when no cookie can be used: a hash of the address and browser
 * that changes every day, so nobody can be followed from one day to the next.
 */
export async function dailyVisitorId(ip: string | null, ua: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  return "d_" + createHash("sha256").update(`${await salt()}|${day}|${ip ?? ""}|${ua}`).digest("hex").slice(0, 24);
}

export const newVisitorId = () => "v_" + randomBytes(12).toString("hex");
const newSessionId = () => randomBytes(12).toString("hex");

const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

/** `/fr/villa` → `/villa`: both languages add up on one page */
export function normalisePath(p: string): { path: string; locale: string } {
  let path = (p || "/").split("?")[0].split("#")[0];
  let locale = "en";
  if (path === "/fr" || path.startsWith("/fr/")) {
    locale = "fr";
    path = path.slice(3) || "/";
  }
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return { path: path.slice(0, 255), locale };
}

export interface PageviewInput {
  visitorId: string;
  url: string; // path + search as seen by the browser
  referrer: string | null;
  title: string | null;
  language: string | null;
  screenWidth: number | null;
  touch: boolean;
  ua: string;
  ip: string | null;
  headers: Headers;
  siteHost: string | null;
}

export async function recordPageview(input: PageviewInput) {
  const now = new Date();
  const u = new URL(input.url, "https://x.invalid");
  const { path, locale } = normalisePath(u.pathname);
  const q = u.searchParams;
  const utm = {
    utmSource: clip(q.get("utm_source"), 100),
    utmMedium: clip(q.get("utm_medium"), 100),
    utmCampaign: clip(q.get("utm_campaign"), 200),
    utmTerm: clip(q.get("utm_term"), 200),
    utmContent: clip(q.get("utm_content"), 200),
  };
  const clickIdType = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid", "li_fat_id"].find((k) => q.has(k)) ?? null;

  let refHost = referrerHost(input.referrer);
  const internal = Boolean(refHost && input.siteHost && refHost === input.siteHost.replace(/^www\./, ""));
  if (internal) refHost = null;
  const external = Boolean(refHost) || Boolean(utm.utmSource) || Boolean(clickIdType);

  const recent = await prisma.analyticsSession.findFirst({
    where: { visitorId: input.visitorId, lastSeenAt: { gt: new Date(now.getTime() - SESSION_GAP_MS) } },
    orderBy: { lastSeenAt: "desc" },
  });
  // a new campaign or source starts a new visit, like the big analytics tools
  const sameSource = recent && (!external || (refHost === recent.referrerHost && utm.utmSource === recent.utmSource));

  let sessionId: string;
  if (recent && sameSource) {
    sessionId = recent.id;
    await prisma.analyticsSession.update({
      where: { id: recent.id },
      data: { lastSeenAt: now, pageviews: { increment: 1 }, exitPath: path },
    });
  } else {
    const attribution = classify({ referrerHost: refHost, utmSource: utm.utmSource, utmMedium: utm.utmMedium, clickIdType });
    const ua = parseUA(input.ua, input.touch);
    const geo = lookupGeo(input.ip, input.headers);
    const visitor = await prisma.analyticsVisitor.findUnique({ where: { id: input.visitorId } });
    sessionId = newSessionId();
    await prisma.analyticsSession.create({
      data: {
        id: sessionId,
        visitorId: input.visitorId,
        isNewVisitor: !visitor,
        startedAt: now,
        lastSeenAt: now,
        pageviews: 1,
        entryPath: path,
        exitPath: path,
        referrer: clip(input.referrer && !internal ? input.referrer.split("#")[0] : null, 500),
        referrerHost: refHost,
        channel: attribution.channel,
        source: clip(attribution.source, 100),
        ...utm,
        clickIdType,
        locale,
        language: clip(input.language, 10),
        country: geo.country,
        region: clip(geo.region, 100),
        city: clip(geo.city, 100),
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        screenWidth: input.screenWidth,
      },
    });
    await prisma.analyticsVisitor.upsert({
      where: { id: input.visitorId },
      create: {
        id: input.visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        sessions: 1,
        firstChannel: attribution.channel,
        firstSource: clip(attribution.source, 100),
        country: geo.country,
        city: clip(geo.city, 100),
      },
      update: { lastSeenAt: now, sessions: { increment: 1 }, country: geo.country ?? undefined, city: clip(geo.city, 100) ?? undefined },
    });
  }
  await prisma.analyticsVisitor.update({ where: { id: input.visitorId }, data: { pageviews: { increment: 1 }, lastSeenAt: now } }).catch(() => {});

  const pv = await prisma.analyticsPageview.create({
    data: { sessionId, visitorId: input.visitorId, path, locale, title: clip(input.title, 200), createdAt: now },
    select: { id: true },
  });
  return { sessionId, pageviewId: pv.id };
}

/** Engagement report for a page: time it was visible and how far it was scrolled. */
export async function recordEngagement(visitorId: string, pageviewId: number, engagedSec: number, scrollPct: number) {
  const pv = await prisma.analyticsPageview.findUnique({ where: { id: pageviewId } });
  if (!pv || pv.visitorId !== visitorId) return;
  const engaged = Math.min(Math.max(0, Math.round(engagedSec)), 4 * 3600);
  const delta = Math.max(0, engaged - pv.engagedSec);
  await prisma.analyticsPageview.update({
    where: { id: pageviewId },
    data: { engagedSec: Math.max(engaged, pv.engagedSec), scrollPct: Math.max(pv.scrollPct, Math.min(100, Math.round(scrollPct))) },
  });
  if (delta > 0) {
    await prisma.analyticsSession.update({
      where: { id: pv.sessionId },
      data: { engagedSec: { increment: delta }, lastSeenAt: new Date() },
    });
  }
}

export const EVENT_NAMES = [
  "quote_view",
  "booking_form_start",
  "booking_request",
  "contact_form_start",
  "contact_submit",
  "click_whatsapp",
  "click_email",
  "click_phone",
  "click_book",
  "outbound",
  "tour_start",
  "gallery_open",
  "map_place",
  "language_switch",
  "portal_login",
  "share",
] as const;

export async function recordEvent(visitorId: string, name: string, path: string | null, props: unknown) {
  const session = await prisma.analyticsSession.findFirst({
    where: { visitorId, lastSeenAt: { gt: new Date(Date.now() - SESSION_GAP_MS) } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });
  const json = props && typeof props === "object" ? JSON.stringify(props).slice(0, 1000) : null;
  await prisma.analyticsEvent.create({
    data: {
      sessionId: session?.id ?? null,
      visitorId,
      name,
      path: path ? normalisePath(path).path : null,
      props: json,
    },
  });
}

/**
 * Link a booking request to the visit it was sent from (cookie of the
 * request). Called by the booking-request API.
 */
export async function attributeBookingRequest(visitorId: string | null | undefined, bookingRequestId: number) {
  if (!visitorId) return null;
  const session = await prisma.analyticsSession.findFirst({
    where: { visitorId, lastSeenAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });
  if (!session) return null;
  await prisma.analyticsSession.update({ where: { id: session.id }, data: { converted: true, bookingRequestId } });
  await prisma.bookingRequest.update({ where: { id: bookingRequestId }, data: { analyticsSessionId: session.id } });
  return session.id;
}

let lastPurge = 0;
/** Drop raw rows past the retention period — at most once a day. */
export function purgeOldAnalytics() {
  if (Date.now() - lastPurge < 86_400_000) return;
  lastPurge = Date.now();
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  Promise.all([
    prisma.analyticsPageview.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.analyticsSession.deleteMany({ where: { lastSeenAt: { lt: cutoff } } }),
    prisma.analyticsVisitor.deleteMany({ where: { lastSeenAt: { lt: cutoff } } }),
    prisma.crawlerHit.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]).catch((e) => console.error("[analytics] purge failed:", e instanceof Error ? e.message : e));
}

export async function analyticsConfig() {
  const s = await getSettings();
  return {
    enabled: s.analytics_enabled !== "0",
    /** "0" = no cookie at all: a daily-rotating hash recognises a visitor for one day */
    useCookie: s.analytics_cookie !== "0",
  };
}
