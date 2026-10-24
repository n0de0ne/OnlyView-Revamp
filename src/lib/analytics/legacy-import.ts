import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classify, referrerHost } from "./channels";
import { SESSION_GAP_MS } from "./collect";
import { isBot, parseUA } from "./ua";

/**
 * Brings the old PHP site's visit history (its `analytics_visits` and
 * `analytics_events` tables) into Analytique, so the curves don't start at
 * zero. Read-only on the legacy tables; raw IP addresses are left behind.
 *
 * Re-runnable: earlier imported rows (legacy = true) are replaced.
 */

type Row = Record<string, unknown>;

/** the schema holding the legacy analytics tables (usually `onlyview` or `public`) */
async function legacySchema(): Promise<string | null> {
  if (process.env.LEGACY_SCHEMA) return process.env.LEGACY_SCHEMA;
  const rows = await prisma.$queryRaw<Array<{ table_schema: string }>>`
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'analytics_visits' AND table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema'`;
  return rows[0]?.table_schema ?? null;
}

const str = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
/** some exports turned hosts into markdown links: "[www.google.com](https://www.google.com)" */
const unlink = (v: string | null) => (v ? v.replace(/^\[([^\]]+)\]\([^)]*\)$/, "$1") : v);

/** old URLs → the new site's paths, so the page tables line up */
function legacyPath(p: string | null): string {
  let path = (p ?? "/").split("?")[0].split("#")[0] || "/";
  path = path.replace(/\.php$/, "").replace(/\/index$/, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path.slice(0, 255) || "/";
}

const EVENT_MAP: Record<string, string> = {
  booking_click: "click_book",
  price_quoted: "quote_view",
  email_click: "click_email",
  whatsapp_click: "click_whatsapp",
  phone_click: "click_phone",
  external_click: "outbound",
  booking_request: "booking_request",
  gallery_view: "gallery_open",
  cta_click: "cta_click",
};

export async function importLegacyAnalytics(dry = false) {
  const schema = await legacySchema();
  if (!schema) return { ok: false as const, error: "no_legacy_tables" };
  const q = (sql: string) => prisma.$queryRawUnsafe<Row[]>(sql);

  const visits = await q(
    `SELECT coalesce(fingerprint, visitor_id) || '|' || coalesce(ip_hash, '') AS vkey, fingerprint, page, referrer, referrer_domain, country, city, region, device, user_agent, language,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id_type, is_datacenter, created_at
     FROM "${schema}".analytics_visits ORDER BY 1, created_at`
  );
  let events: Row[] = [];
  try {
    events = await q(
      `SELECT event_type, fingerprint, page, data, created_at FROM "${schema}".analytics_events
       WHERE event_type IN (${Object.keys(EVENT_MAP).map((e) => `'${e}'`).join(",")}) ORDER BY created_at`
    );
  } catch {
    // table missing: visits alone
  }

  type SessionRow = Prisma.AnalyticsSessionCreateManyInput & { pageviews: number; startedAt: Date };
  const sessions: SessionRow[] = [];
  const pageviews: Array<{ sessionId: string; visitorId: string; path: string; createdAt: Date }> = [];
  const visitors = new Map<string, { first: Date; last: Date; sessions: number; pageviews: number; channel: string; source: string | null; country: string | null; city: string | null }>();
  /** visits per legacy browser fingerprint, to place the events */
  const byFingerprint = new Map<string, Array<{ id: string; visitorId: string; start: number; end: number }>>();
  let skippedBots = 0;

  let current: { id: string; visitorId: string; last: number; data: SessionRow } | null = null;
  for (const v of visits) {
    const ua = str(v.user_agent) ?? "";
    if (Number(v.is_datacenter) === 1 || isBot(ua)) {
      skippedBots++;
      continue;
    }
    // the old site issued a new visitor id on every visit: its browser
    // fingerprint plus the hashed address is the closest thing to a visitor
    const key = str(v.vkey);
    if (!key) continue;
    const visitorId = `l_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    const fp = str(v.fingerprint) ?? key;
    const at = new Date(v.created_at as string);
    const path = legacyPath(str(v.page));

    if (current && current.visitorId === visitorId && at.getTime() - current.last < SESSION_GAP_MS) {
      current.data.pageviews += 1;
      current.data.exitPath = path;
      current.data.lastSeenAt = at;
      current.last = at.getTime();
      pageviews.push({ sessionId: current.id, visitorId, path, createdAt: at });
      visitors.get(visitorId)!.pageviews++;
      byFingerprint.get(fp)!.at(-1)!.end = at.getTime();
      continue;
    }

    const refHostRaw = unlink(str(v.referrer_domain)) ?? referrerHost(str(v.referrer));
    let host = refHostRaw ? referrerHost(`https://${refHostRaw.toLowerCase()}/`) ?? refHostRaw.toLowerCase() : null;
    if (host && /onlyviewstbarth\.com$/.test(host)) host = null;
    const attribution = classify({
      referrerHost: host,
      utmSource: str(v.utm_source),
      utmMedium: str(v.utm_medium),
      clickIdType: str(v.click_id_type),
    });
    const info = parseUA(ua);
    const country = str(v.country);
    const id = randomBytes(12).toString("hex");
    const known = visitors.get(visitorId);
    const data: SessionRow = {
      id,
      visitorId,
      isNewVisitor: !known,
      startedAt: at,
      lastSeenAt: at,
      pageviews: 1,
      entryPath: path,
      exitPath: path,
      referrer: host && !/onlyviewstbarth\.com/.test(str(v.referrer) ?? "") ? str(v.referrer)?.slice(0, 500) ?? null : null,
      referrerHost: host,
      channel: attribution.channel,
      source: attribution.source?.slice(0, 100) ?? null,
      utmSource: str(v.utm_source)?.slice(0, 100) ?? null,
      utmMedium: str(v.utm_medium)?.slice(0, 100) ?? null,
      utmCampaign: str(v.utm_campaign)?.slice(0, 200) ?? null,
      utmContent: str(v.utm_content)?.slice(0, 200) ?? null,
      utmTerm: str(v.utm_term)?.slice(0, 200) ?? null,
      clickIdType: str(v.click_id_type)?.slice(0, 20) ?? null,
      locale: "en",
      language: str(v.language)?.slice(0, 10) ?? null,
      country: country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
      region: str(v.region)?.slice(0, 100) ?? null,
      city: str(v.city)?.slice(0, 100) ?? null,
      device: str(v.device) ?? info.device,
      browser: info.browser,
      os: info.os,
      legacy: true,
    };
    sessions.push(data);
    current = { id, visitorId, last: at.getTime(), data };
    pageviews.push({ sessionId: id, visitorId, path, createdAt: at });
    if (known) {
      known.sessions++;
      known.pageviews++;
      known.last = at;
    } else {
      visitors.set(visitorId, {
        first: at,
        last: at,
        sessions: 1,
        pageviews: 1,
        channel: attribution.channel,
        source: data.source ?? null,
        country: data.country ?? null,
        city: data.city ?? null,
      });
    }
    const list = byFingerprint.get(fp) ?? [];
    list.push({ id, visitorId, start: at.getTime(), end: at.getTime() });
    byFingerprint.set(fp, list);
  }

  // events join the visit of the same visitor they happened in
  const eventRows: Array<{ sessionId: string; visitorId: string; name: string; path: string; props: string | null; createdAt: Date }> = [];
  for (const e of events) {
    const fp = str(e.fingerprint);
    if (!fp) continue;
    const at = new Date(e.created_at as string).getTime();
    const s = byFingerprint.get(fp)?.find((x) => at >= x.start - 60_000 && at <= x.end + SESSION_GAP_MS);
    if (!s) continue;
    eventRows.push({
      sessionId: s.id,
      visitorId: s.visitorId,
      name: EVENT_MAP[String(e.event_type)],
      path: legacyPath(str(e.page)),
      props: str(e.data)?.slice(0, 1000) ?? null,
      createdAt: new Date(at),
    });
  }
  // a visit that sent the old booking form counts as a conversion
  const converted = new Set(eventRows.filter((e) => e.name === "booking_request").map((e) => e.sessionId));
  for (const s of sessions) if (converted.has(s.id)) s.converted = true;

  const summary = {
    schema,
    sessions: sessions.length,
    pageviews: pageviews.length,
    visitors: visitors.size,
    events: eventRows.length,
    skippedBots,
    from: sessions.length ? new Date(Math.min(...sessions.map((s) => s.startedAt.getTime()))) : null,
    to: sessions.length ? new Date(Math.max(...sessions.map((s) => s.startedAt.getTime()))) : null,
  };
  if (dry) return { ok: true as const, dry: true, ...summary };

  await prisma.$transaction(
    async (tx) => {
      const old = await tx.analyticsSession.findMany({ where: { legacy: true }, select: { id: true } });
      const oldIds = old.map((o) => o.id);
      for (let i = 0; i < oldIds.length; i += 5000) {
        const chunk = oldIds.slice(i, i + 5000);
        await tx.analyticsPageview.deleteMany({ where: { sessionId: { in: chunk } } });
        await tx.analyticsEvent.deleteMany({ where: { sessionId: { in: chunk } } });
      }
      await tx.analyticsSession.deleteMany({ where: { legacy: true } });
      await tx.analyticsVisitor.deleteMany({ where: { legacy: true } });

      const chunks = <T,>(arr: T[], n = 2000) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
      for (const c of chunks(sessions)) await tx.analyticsSession.createMany({ data: c });
      for (const c of chunks(pageviews)) await tx.analyticsPageview.createMany({ data: c });
      for (const c of chunks(eventRows)) await tx.analyticsEvent.createMany({ data: c });
      for (const c of chunks([...visitors.entries()])) {
        await tx.analyticsVisitor.createMany({
          data: c.map(([id, v]) => ({
            id,
            firstSeenAt: v.first,
            lastSeenAt: v.last,
            sessions: v.sessions,
            pageviews: v.pageviews,
            firstChannel: v.channel,
            firstSource: v.source,
            country: v.country,
            city: v.city,
            legacy: true,
          })),
          skipDuplicates: true,
        });
      }
    },
    { timeout: 120_000 }
  );
  return { ok: true as const, dry: false, ...summary };
}
