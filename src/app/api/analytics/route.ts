import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsConfig,
  clientIp,
  dailyVisitorId,
  EVENT_NAMES,
  newVisitorId,
  OPTOUT_COOKIE,
  purgeOldAnalytics,
  recordEngagement,
  recordEvent,
  recordPageview,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/lib/analytics/collect";
import { isBot } from "@/lib/analytics/ua";

export const dynamic = "force-dynamic";

/**
 * Collector for the site's own audience measurement (components/site/Analytics).
 * Bodies arrive as text (navigator.sendBeacon) and hold one of:
 *   pageview   { t:"pv", u, r, ti, la, sw, to }
 *   engagement { t:"en", pv, e, s }
 *   event      { t:"ev", n, u, d }
 */
const Body = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("pv"),
    u: z.string().max(2000),
    r: z.string().max(2000).nullish(),
    ti: z.string().max(300).nullish(),
    la: z.string().max(20).nullish(),
    sw: z.number().int().min(0).max(20000).nullish(),
    to: z.boolean().nullish(),
  }),
  z.object({ t: z.literal("en"), pv: z.number().int().positive(), e: z.number().min(0), s: z.number().min(0).max(100) }),
  z.object({
    t: z.literal("ev"),
    n: z.enum(EVENT_NAMES),
    u: z.string().max(2000).nullish(),
    d: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).nullish(),
  }),
]);

const empty = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  // owner/staff browsing the site, opted-out visitors and bots are not counted
  if (req.cookies.has("ov_admin") || req.cookies.get(OPTOUT_COOKIE)?.value === "1" || isBot(ua)) return empty();

  const config = await analyticsConfig();
  if (!config.enabled) return empty();

  const raw = await req.text().catch(() => "");
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  const parsed = Body.safeParse(json);
  if (!parsed.success) return empty();
  const b = parsed.data;

  const ip = clientIp(req.headers);
  let visitorId = config.useCookie ? req.cookies.get(VISITOR_COOKIE)?.value : undefined;
  if (visitorId && !/^[vd]_[a-f0-9]{24}$/.test(visitorId)) visitorId = undefined;
  let setCookie = false;
  if (!visitorId) {
    // engagement and events only make sense for a visitor we already saw
    if (b.t !== "pv" && config.useCookie) return empty();
    visitorId = config.useCookie ? newVisitorId() : await dailyVisitorId(ip, ua);
    setCookie = config.useCookie;
  }

  try {
    purgeOldAnalytics();
    if (b.t === "pv") {
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const { pageviewId } = await recordPageview({
        visitorId,
        url: b.u,
        referrer: b.r ?? null,
        title: b.ti ?? null,
        language: b.la ?? null,
        screenWidth: b.sw ?? null,
        touch: Boolean(b.to),
        ua,
        ip,
        headers: req.headers,
        siteHost: host?.split(":")[0] ?? null,
      });
      const res = NextResponse.json({ pv: pageviewId });
      if (setCookie) {
        res.cookies.set(VISITOR_COOKIE, visitorId, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: VISITOR_COOKIE_MAX_AGE,
        });
      }
      return res;
    }
    if (b.t === "en") await recordEngagement(visitorId, b.pv, b.e, b.s);
    else await recordEvent(visitorId, b.n, b.u ?? null, b.d ?? null);
  } catch (e) {
    console.error("[analytics]", e instanceof Error ? e.message : e);
  }
  return empty();
}
