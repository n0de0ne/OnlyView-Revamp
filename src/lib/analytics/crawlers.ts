import { prisma } from "@/lib/db";
import { matchCrawler } from "./ua";

/** what crawlers read: pages, plus the files written for them */
const SKIP = /^\/(_next|api|admin|media|icon|apple-icon|favicon)|\.(png|jpe?g|webp|avif|gif|svg|ico|css|js|map|woff2?|mp4|webm|json)$/i;

/**
 * Log a search-engine or AI crawler fetching a page (Admin → Analytique →
 * Robots). They run no JavaScript, so the browser tracker never sees them.
 * Fire-and-forget: never delays or fails the response.
 */
export function logCrawlerHit(pathname: string, ua: string | null) {
  if (SKIP.test(pathname)) return;
  const c = matchCrawler(ua);
  if (!c) return;
  let path = pathname.slice(0, 255);
  if (path.length > 1) path = path.replace(/\/+$/, "");
  prisma.crawlerHit
    .create({ data: { bot: c.bot, category: c.category, operator: c.operator, path } })
    .catch(() => {});
}
