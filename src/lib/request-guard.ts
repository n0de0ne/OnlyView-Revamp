import { isIP } from "node:net";

/** HTML-escape a value typed on the public site before it goes into an email (night GN-507). */
export const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A field that lands in a mail header or subject: one line only (night GN-507, defence in depth). */
export const oneLine = (s: string) => !/[\r\n]/.test(s);

/**
 * The visitor's IP for rate limits (night GN-508). The first X-Forwarded-For entry is whatever the browser sent;
 * the proxy appends the address it saw, so the last TRUSTED_PROXIES (default 1) entry is read. Cloudflare's own
 * header wins when present, as the analytics already read it.
 *
 * This relies on the app port never being reachable except through the Cloudflare tunnel (DevOps' ufw / DOCKER-USER
 * rules): anyone reaching the app directly could write cf-connecting-ip themselves.
 */
export function requestIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf && isIP(cf)) return cf;
  const hops = Math.max(1, parseInt(process.env.TRUSTED_PROXIES ?? "", 10) || 1);
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (chain.length) return chain[Math.max(0, chain.length - hops)];
  return h.get("x-real-ip")?.trim() || "local";
}

/** A naive in-memory limit (per runtime instance): `max` hits per key per hour. */
export function hourlyLimit(max: number) {
  const hits = new Map<string, { count: number; at: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.at > 3600_000) {
      hits.set(key, { count: 1, at: now });
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 3600_000) hits.delete(k);
      return false;
    }
    h.count += 1;
    return h.count > max;
  };
}

/** A real calendar day as YYYY-MM-DD (2027-02-30 and 2027-13-01 are not) (night GN-509). */
export const realDay = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
