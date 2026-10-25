import "server-only";
import { randomBytes } from "crypto";
import { SITE_URL } from "./seo";
import { getSettings, setSetting } from "./settings";

/**
 * IndexNow (indexnow.org): one POST tells Bing, Yandex, Seznam, Naver and
 * every engine sharing the protocol that a URL changed, and they fetch it
 * within minutes instead of whenever their crawler next comes round. Bing's
 * index is what Copilot and ChatGPT search answer from, so this is the
 * shortest path from "content changed" to "an AI engine quotes the new
 * text". The key is generated once and kept in Réglages; the engines verify
 * it by fetching /indexnow-key.txt.
 */
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export async function getIndexNowKey(): Promise<string> {
  const s = await getSettings();
  const existing = s.indexnow_key?.trim();
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
  const key = randomBytes(16).toString("hex");
  await setSetting("indexnow_key", key);
  return key;
}

export interface IndexNowResult {
  ok: boolean;
  status: number;
  count: number;
  at: string;
  error?: string;
}

/** The public site only — a localhost or a staging host would be rejected
    by the engines (and would leak a staging URL). */
export function indexNowEnabled(): boolean {
  try {
    const u = new URL(SITE_URL);
    return u.protocol === "https:" && !/localhost|127\.0\.0\.1|\.local$|\.internal$/.test(u.hostname);
  } catch {
    return false;
  }
}

export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  const at = new Date().toISOString();
  const list = [...new Set(urls.filter((u) => u.startsWith(SITE_URL)))].slice(0, 10_000);
  if (!indexNowEnabled()) return { ok: false, status: 0, count: list.length, at, error: "site_url_not_public" };
  if (list.length === 0) return { ok: false, status: 0, count: 0, at, error: "no_urls" };
  const key = await getIndexNowKey();
  let result: IndexNowResult;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key,
        keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`,
        urlList: list,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // 200 and 202 both mean "received"; 4xx carry the reason
    result = { ok: res.status === 200 || res.status === 202, status: res.status, count: list.length, at };
    if (!result.ok) result.error = `http_${res.status}`;
  } catch (e) {
    result = { ok: false, status: 0, count: list.length, at, error: e instanceof Error ? e.message : "network_error" };
  }
  await setSetting("indexnow_last", JSON.stringify(result)).catch(() => {});
  return result;
}

/** Every public URL of the site, both languages — what a full resubmission sends. */
export async function allPublicUrls(): Promise<string[]> {
  const { default: sitemap } = await import("@/app/sitemap");
  const entries = await sitemap();
  return entries.map((e) => e.url);
}

/** Fire-and-forget ping for a handful of pages that just changed (a review
    approved, a setting saved): never delays or fails the caller. */
export function pingIndexNow(paths: string[]) {
  if (!indexNowEnabled()) return;
  const urls = paths.flatMap((p) => [`${SITE_URL}${p === "/" ? "" : p}`, `${SITE_URL}/fr${p === "/" ? "" : p}`]);
  submitIndexNow(urls).catch(() => {});
}

export async function lastIndexNow(): Promise<IndexNowResult | null> {
  const s = await getSettings();
  try {
    return s.indexnow_last ? (JSON.parse(s.indexnow_last) as IndexNowResult) : null;
  } catch {
    return null;
  }
}
