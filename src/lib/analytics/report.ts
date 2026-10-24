import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Admin → Analytique: every figure of the dashboard for one period, plus
 * the same headline figures for the period just before it.
 *
 * Days are St Barth days (UTC−4, no daylight saving).
 */

export const TZ = "America/St_Barthelemy";
const OFFSET = "-04:00";

export interface Segment {
  channel?: string | null;
  source?: string | null;
  country?: string | null;
  device?: string | null;
  /** sessions that viewed this page */
  page?: string | null;
}

export interface Period {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
}

const start = (d: string) => new Date(`${d}T00:00:00${OFFSET}`);
const endExclusive = (d: string) => new Date(start(d).getTime() + 86_400_000);

/** columns are UTC timestamps without time zone: compare against UTC wall time, whatever the server's TimeZone */
const utc = (d: Date) => Prisma.sql`${d.toISOString().slice(0, 23)}::timestamp`;

const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : v == null ? 0 : Number(v));

function segmentSql(seg: Segment, alias = "s") {
  const parts: Prisma.Sql[] = [];
  const col = (c: string) => Prisma.raw(`${alias}."${c}"`);
  if (seg.channel) parts.push(Prisma.sql`${col("channel")} = ${seg.channel}`);
  if (seg.source) parts.push(Prisma.sql`${col("source")} = ${seg.source}`);
  if (seg.country) parts.push(seg.country === "??" ? Prisma.sql`${col("country")} IS NULL` : Prisma.sql`${col("country")} = ${seg.country}`);
  if (seg.device) parts.push(Prisma.sql`${col("device")} = ${seg.device}`);
  if (seg.page)
    parts.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "AnalyticsPageview" sp WHERE sp."sessionId" = ${col("id")} AND sp."path" = ${seg.page})`
    );
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, " AND ")}` : Prisma.empty;
}

/** a visit "bounced" when it saw one page, for under 10 s, without booking */
const BOUNCE = Prisma.sql`(s."pageviews" <= 1 AND s."engagedSec" < 10 AND NOT s."converted")`;
/** time on page wasn't measured by the old site: its visits stay out of time and bounce figures */
const MEASURED = Prisma.sql`NOT s."legacy"`;

async function headline(p: Period, seg: Segment) {
  const w = segmentSql(seg);
  const [row] = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT count(*) AS sessions,
           count(DISTINCT s."visitorId") AS visitors,
           count(DISTINCT s."visitorId") FILTER (WHERE s."isNewVisitor") AS "newVisitors",
           coalesce(sum(s."pageviews"), 0) AS pageviews,
           avg(s."engagedSec") FILTER (WHERE ${MEASURED}) AS "avgEngaged",
           count(*) FILTER (WHERE ${MEASURED}) AS measured,
           count(*) FILTER (WHERE ${BOUNCE} AND ${MEASURED}) AS bounces,
           count(*) FILTER (WHERE s."converted") AS conversions
    FROM "AnalyticsSession" s
    WHERE s."startedAt" >= ${utc(start(p.from))} AND s."startedAt" < ${utc(endExclusive(p.to))} ${w}`;
  const sessions = n(row.sessions);
  return {
    sessions,
    visitors: n(row.visitors),
    newVisitors: n(row.newVisitors),
    pageviews: n(row.pageviews),
    avgEngagedSec: n(row.measured) ? Math.round(n(row.avgEngaged)) : null,
    bounceRate: n(row.measured) ? n(row.bounces) / n(row.measured) : null,
    pagesPerSession: sessions ? n(row.pageviews) / sessions : 0,
    conversions: n(row.conversions),
    conversionRate: sessions ? n(row.conversions) / sessions : 0,
  };
}

export function previousPeriod(p: Period): Period {
  const days = Math.round((start(p.to).getTime() - start(p.from).getTime()) / 86_400_000) + 1;
  const prevTo = new Date(start(p.from).getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  const iso = (d: Date) => new Date(d.getTime() - 4 * 3600_000).toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

/** group a session column, with the figures every breakdown table shows */
async function breakdown(p: Period, seg: Segment, expr: Prisma.Sql, limit = 25, extra: Prisma.Sql = Prisma.empty) {
  const w = segmentSql(seg);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT ${expr} AS key ${extra},
           count(*) AS sessions,
           count(DISTINCT s."visitorId") AS visitors,
           avg(s."engagedSec") FILTER (WHERE ${MEASURED}) AS "avgEngaged",
           count(*) FILTER (WHERE ${MEASURED}) AS measured,
           count(*) FILTER (WHERE ${BOUNCE} AND ${MEASURED}) AS bounces,
           count(*) FILTER (WHERE s."converted") AS conversions
    FROM "AnalyticsSession" s
    WHERE s."startedAt" >= ${utc(start(p.from))} AND s."startedAt" < ${utc(endExclusive(p.to))} ${w}
    GROUP BY 1 ${extra === Prisma.empty ? Prisma.empty : Prisma.sql`, 2`}
    ORDER BY sessions DESC
    LIMIT ${limit}`;
  return rows.map((r) => {
    const sessions = n(r.sessions);
    const out: Record<string, unknown> = {
      key: r.key ?? null,
      sessions,
      visitors: n(r.visitors),
      avgEngagedSec: n(r.measured) ? Math.round(n(r.avgEngaged)) : null,
      bounceRate: n(r.measured) ? n(r.bounces) / n(r.measured) : null,
      conversions: n(r.conversions),
    };
    if ("extra" in r) out.extra = r.extra ?? null;
    return out;
  });
}

export async function analyticsReport(p: Period, seg: Segment) {
  const from = start(p.from);
  const to = endExclusive(p.to);
  const w = segmentSql(seg);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const bucket = days > 400 ? "month" : days > 120 ? "week" : "day";
  const prev = previousPeriod(p);

  const [
    current,
    previous,
    series,
    pages,
    entries,
    channels,
    sources,
    referrers,
    referrerUrls,
    campaigns,
    countries,
    cities,
    devices,
    browsers,
    oses,
    languages,
    siteLocales,
    hours,
    funnelRows,
    confirmed,
    events,
    outbound,
    aiLanding,
    returning,
  ] = await Promise.all([
    headline(p, seg),
    headline(prev, seg),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT to_char(date_trunc(${bucket}, (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS day,
             count(*) AS sessions,
             count(DISTINCT s."visitorId") AS visitors,
             coalesce(sum(s."pageviews"), 0) AS pageviews,
             count(*) FILTER (WHERE s."converted") AS conversions,
             count(*) FILTER (WHERE s."channel" = 'ai') AS ai,
             count(*) FILTER (WHERE s."channel" = 'search') AS search
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} ${w}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pv."path" AS path,
             count(*) AS views,
             count(DISTINCT pv."visitorId") AS visitors,
             coalesce(avg(pv."engagedSec") FILTER (WHERE pv."engagedSec" > 0), 0) AS "avgEngaged",
             coalesce(avg(pv."scrollPct") FILTER (WHERE pv."scrollPct" > 0), 0) AS "avgScroll",
             count(*) FILTER (WHERE pv."locale" = 'fr') AS fr
      FROM "AnalyticsPageview" pv JOIN "AnalyticsSession" s ON s."id" = pv."sessionId"
      WHERE pv."createdAt" >= ${utc(from)} AND pv."createdAt" < ${utc(to)} ${w}
      GROUP BY 1 ORDER BY views DESC LIMIT 40`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."entryPath" AS path, count(*) AS sessions,
             count(*) FILTER (WHERE ${MEASURED}) AS measured,
             count(*) FILTER (WHERE ${BOUNCE} AND ${MEASURED}) AS bounces,
             count(*) FILTER (WHERE s."converted") AS conversions
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} ${w}
      GROUP BY 1 ORDER BY sessions DESC LIMIT 25`,
    breakdown(p, seg, Prisma.sql`s."channel"`, 20),
    breakdown(p, seg, Prisma.sql`coalesce(s."source", '(direct)')`, 40, Prisma.sql`, s."channel" AS extra`),
    breakdown(p, seg, Prisma.sql`s."referrerHost"`, 40),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."referrer" AS url, count(*) AS sessions
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} AND s."referrer" IS NOT NULL ${w}
      GROUP BY 1 ORDER BY sessions DESC LIMIT 40`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."utmCampaign" AS campaign, s."utmSource" AS source, s."utmMedium" AS medium,
             count(*) AS sessions, count(*) FILTER (WHERE s."converted") AS conversions
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)}
        AND (s."utmCampaign" IS NOT NULL OR s."utmSource" IS NOT NULL) ${w}
      GROUP BY 1, 2, 3 ORDER BY sessions DESC LIMIT 30`,
    breakdown(p, seg, Prisma.sql`s."country"`, 60),
    breakdown(p, seg, Prisma.sql`s."city"`, 40, Prisma.sql`, s."country" AS extra`),
    breakdown(p, seg, Prisma.sql`s."device"`, 5),
    breakdown(p, seg, Prisma.sql`s."browser"`, 12),
    breakdown(p, seg, Prisma.sql`s."os"`, 12),
    breakdown(p, seg, Prisma.sql`lower(split_part(coalesce(s."language", ''), '-', 1))`, 15),
    breakdown(p, seg, Prisma.sql`s."locale"`, 3),
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT extract(isodow FROM (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::int AS dow,
             extract(hour FROM (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::int AS hour,
             count(*) AS sessions
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} ${w}
      GROUP BY 1, 2`,
    // each step includes the visits that went further, so the funnel never widens
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      WITH f AS (
        SELECT s."converted" AS request,
               EXISTS (SELECT 1 FROM "AnalyticsEvent" e WHERE e."sessionId" = s."id" AND e."name" = 'booking_form_start') AS form,
               EXISTS (SELECT 1 FROM "AnalyticsEvent" e WHERE e."sessionId" = s."id" AND e."name" = 'quote_view') AS quote,
               EXISTS (SELECT 1 FROM "AnalyticsPageview" pv WHERE pv."sessionId" = s."id" AND pv."path" IN ('/rates', '/booking')) AS rates,
               EXISTS (SELECT 1 FROM "AnalyticsPageview" pv WHERE pv."sessionId" = s."id"
                 AND pv."path" IN ('/villa', '/tour', '/gallery', '/location', '/reviews')) AS explored,
               EXISTS (SELECT 1 FROM "AnalyticsEvent" e WHERE e."sessionId" = s."id"
                 AND e."name" IN ('contact_submit', 'click_whatsapp', 'click_email', 'click_phone')) AS contact
        FROM "AnalyticsSession" s
        WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} ${w}
      )
      SELECT count(*) AS sessions,
             count(*) FILTER (WHERE explored OR rates OR quote OR form OR request) AS explored,
             count(*) FILTER (WHERE rates OR quote OR form OR request) AS rates,
             count(*) FILTER (WHERE quote OR form OR request) AS quote,
             count(*) FILTER (WHERE form OR request) AS form,
             count(*) FILTER (WHERE request) AS request,
             count(*) FILTER (WHERE request OR contact) AS contacted
      FROM f`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(*) AS n
      FROM "AnalyticsSession" s
      JOIN "BookingRequest" b ON b."id" = s."bookingRequestId"
      JOIN "Reservation" r ON r."id" = b."reservationId"
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} AND r."status" = 'confirmed' ${w}`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT e."name" AS name, count(*) AS n, count(DISTINCT e."sessionId") AS sessions
      FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."id" = e."sessionId"
      WHERE e."createdAt" >= ${utc(from)} AND e."createdAt" < ${utc(to)} ${w}
      GROUP BY 1 ORDER BY n DESC`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT e."props"::json->>'host' AS host, count(*) AS n
      FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."id" = e."sessionId"
      WHERE e."createdAt" >= ${utc(from)} AND e."createdAt" < ${utc(to)} AND e."name" = 'outbound' ${w}
      GROUP BY 1 ORDER BY n DESC LIMIT 20`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."source" AS source, s."entryPath" AS path, count(*) AS sessions
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} AND s."channel" = 'ai' ${w}
      GROUP BY 1, 2 ORDER BY sessions DESC LIMIT 20`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT count(*) FILTER (WHERE s."isNewVisitor") AS "new",
             count(*) FILTER (WHERE NOT s."isNewVisitor") AS returning
      FROM "AnalyticsSession" s
      WHERE s."startedAt" >= ${utc(from)} AND s."startedAt" < ${utc(to)} ${w}`,
  ]);

  const f = funnelRows[0] ?? {};
  const funnel = [
    { step: "Visites", n: n(f.sessions) },
    { step: "Ont exploré la villa", n: n(f.explored) },
    { step: "Ont vu tarifs / réservation", n: n(f.rates) },
    { step: "Ont obtenu un devis", n: n(f.quote) },
    { step: "Ont commencé la demande", n: n(f.form) },
    { step: "Demande envoyée", n: n(f.request) },
    { step: "Réservation confirmée", n: n(confirmed[0]?.n) },
  ];

  const num = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" || (typeof v === "object" && v !== null && "toNumber" in v) ? n(v) : v])));

  return {
    period: p,
    previous: prev,
    bucket,
    kpis: current,
    previousKpis: previous,
    series: num(series),
    pages: num(pages).map((r) => ({ ...r, avgEngaged: Math.round(n(r.avgEngaged)), avgScroll: Math.round(n(r.avgScroll)) })),
    entries: num(entries),
    channels,
    sources,
    referrers,
    referrerUrls: num(referrerUrls),
    campaigns: num(campaigns),
    countries,
    cities,
    devices,
    browsers,
    oses,
    languages,
    siteLocales,
    hours: num(hours),
    funnel,
    contacted: n(f.contacted),
    events: num(events),
    outbound: num(outbound),
    aiLanding: num(aiLanding),
    newSessions: n(returning[0]?.new),
    returningSessions: n(returning[0]?.returning),
  };
}

/** Who is on the site right now (activity in the last 5 minutes). */
export async function liveVisitors() {
  const since = new Date(Date.now() - 5 * 60_000);
  const rows = await prisma.analyticsSession.findMany({
    where: { lastSeenAt: { gte: since } },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: {
      id: true,
      exitPath: true,
      entryPath: true,
      pageviews: true,
      engagedSec: true,
      startedAt: true,
      lastSeenAt: true,
      country: true,
      city: true,
      device: true,
      channel: true,
      source: true,
      isNewVisitor: true,
    },
  });
  return rows;
}

export interface SessionFilter extends Segment {
  converted?: boolean;
  returning?: boolean;
}

/** Recent visits with their page-by-page path. */
export async function visitJourneys(p: Period, seg: SessionFilter, page = 0, take = 30) {
  const where: Prisma.AnalyticsSessionWhereInput = {
    startedAt: { gte: start(p.from), lt: endExclusive(p.to) },
    ...(seg.channel ? { channel: seg.channel } : {}),
    ...(seg.source ? { source: seg.source } : {}),
    ...(seg.country ? { country: seg.country === "??" ? null : seg.country } : {}),
    ...(seg.device ? { device: seg.device } : {}),
    ...(seg.converted ? { converted: true } : {}),
    ...(seg.returning ? { isNewVisitor: false } : {}),
  };
  if (seg.page) {
    const ids = await prisma.analyticsPageview.findMany({
      where: { path: seg.page, createdAt: { gte: start(p.from), lt: endExclusive(p.to) } },
      select: { sessionId: true },
      distinct: ["sessionId"],
      take: 5000,
    });
    where.id = { in: ids.map((i) => i.sessionId) };
  }
  const [total, sessions] = await Promise.all([
    prisma.analyticsSession.count({ where }),
    prisma.analyticsSession.findMany({ where, orderBy: { startedAt: "desc" }, skip: page * take, take }),
  ]);
  const ids = sessions.map((s) => s.id);
  const [pvs, evs, visitors, requests] = await Promise.all([
    prisma.analyticsPageview.findMany({
      where: { sessionId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: { sessionId: true, path: true, locale: true, createdAt: true, engagedSec: true, scrollPct: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { sessionId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: { sessionId: true, name: true, path: true, props: true, createdAt: true },
    }),
    prisma.analyticsVisitor.findMany({
      where: { id: { in: [...new Set(sessions.map((s) => s.visitorId))] } },
      select: { id: true, sessions: true, firstSeenAt: true, firstChannel: true, firstSource: true },
    }),
    prisma.bookingRequest.findMany({
      where: { id: { in: sessions.map((s) => s.bookingRequestId).filter((x): x is number => x != null) } },
      select: { id: true, name: true, startDate: true, endDate: true, status: true, reservationId: true },
    }),
  ]);
  const vMap = new Map(visitors.map((v) => [v.id, v]));
  const rMap = new Map(requests.map((r) => [r.id, r]));
  return {
    total,
    sessions: sessions.map((s) => ({
      ...s,
      visitor: vMap.get(s.visitorId) ?? null,
      request: s.bookingRequestId ? rMap.get(s.bookingRequestId) ?? null : null,
      pages: pvs.filter((x) => x.sessionId === s.id),
      events: evs.filter((x) => x.sessionId === s.id),
    })),
  };
}

/** Booking requests of the period with where each one came from. */
export async function attributedRequests(p: Period) {
  const requests = await prisma.bookingRequest.findMany({
    where: { createdAt: { gte: start(p.from), lt: endExclusive(p.to) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      status: true,
      analyticsSessionId: true,
      reservation: { select: { id: true, status: true, priceTTC: true } },
    },
  });
  const sessions = await prisma.analyticsSession.findMany({
    where: { id: { in: requests.map((r) => r.analyticsSessionId).filter((x): x is string => !!x) } },
  });
  const visitors = await prisma.analyticsVisitor.findMany({
    where: { id: { in: sessions.map((s) => s.visitorId) } },
  });
  const sMap = new Map(sessions.map((s) => [s.id, s]));
  const vMap = new Map(visitors.map((v) => [v.id, v]));
  return requests.map((r) => {
    const s = r.analyticsSessionId ? sMap.get(r.analyticsSessionId) : undefined;
    const v = s ? vMap.get(s.visitorId) : undefined;
    return {
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      reservation: r.reservation,
      session: s
        ? {
            id: s.id,
            channel: s.channel,
            source: s.source,
            entryPath: s.entryPath,
            country: s.country,
            city: s.city,
            device: s.device,
            pageviews: s.pageviews,
            engagedSec: s.engagedSec,
            utmCampaign: s.utmCampaign,
          }
        : null,
      visitor: v
        ? { sessions: v.sessions, firstSeenAt: v.firstSeenAt, firstChannel: v.firstChannel, firstSource: v.firstSource }
        : null,
    };
  });
}

/** Search-engine and AI crawlers that fetched the site. */
export async function crawlerReport(p: Period) {
  const from = start(p.from);
  const to = endExclusive(p.to);
  const [bots, daily, aiPaths, special] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c."bot", c."operator", c."category", count(*) AS hits, count(DISTINCT c."path") AS pages, max(c."createdAt") AS "lastSeen"
      FROM "CrawlerHit" c WHERE c."createdAt" >= ${utc(from)} AND c."createdAt" < ${utc(to)}
      GROUP BY 1, 2, 3 ORDER BY hits DESC`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT to_char(date_trunc('day', (c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS day,
             count(*) FILTER (WHERE c."category" LIKE 'ai_%') AS ai,
             count(*) FILTER (WHERE c."category" = 'search') AS search,
             count(*) FILTER (WHERE c."category" NOT LIKE 'ai_%' AND c."category" <> 'search') AS other
      FROM "CrawlerHit" c WHERE c."createdAt" >= ${utc(from)} AND c."createdAt" < ${utc(to)}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c."path", count(*) AS hits, count(DISTINCT c."bot") AS bots,
             string_agg(DISTINCT c."bot", ', ') AS names
      FROM "CrawlerHit" c WHERE c."createdAt" >= ${utc(from)} AND c."createdAt" < ${utc(to)} AND c."category" LIKE 'ai_%'
      GROUP BY 1 ORDER BY hits DESC LIMIT 25`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c."path", c."bot", max(c."createdAt") AS "lastSeen", count(*) AS hits
      FROM "CrawlerHit" c
      WHERE c."path" IN ('/robots.txt', '/llms.txt', '/sitemap.xml')
      GROUP BY 1, 2 ORDER BY "lastSeen" DESC LIMIT 40`,
  ]);
  const fix = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));
  return { bots: fix(bots), daily: fix(daily), aiPaths: fix(aiPaths), special: fix(special) };
}
