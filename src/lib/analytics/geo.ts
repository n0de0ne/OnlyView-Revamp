import "server-only";
import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, unlinkSync, accessSync, constants } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Reader, type CityResponse } from "mmdb-lib";

/**
 * Visitor location from an offline database on this server — no visitor IP
 * ever goes to a third-party lookup service.
 *
 * Database: DB-IP "IP to City Lite" (free, CC BY 4.0, updated monthly). It is
 * downloaded on first use into /data/geo (the persistent volume) and
 * refreshed when older than 35 days. GEOIP_DB_PATH points at another .mmdb
 * (e.g. MaxMind GeoLite2-City); GEOIP_AUTO_DOWNLOAD=off disables the download.
 *
 * A Cloudflare front adds `cf-ipcountry` — used when the database can't say.
 */

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
}

const MAX_AGE_MS = 35 * 86_400_000;

function geoDir(): string {
  if (process.env.GEOIP_DIR) return process.env.GEOIP_DIR;
  try {
    accessSync("/data", constants.W_OK);
    return "/data/geo";
  } catch {
    return path.join(process.cwd(), ".cache", "geo");
  }
}

const dbPath = () => process.env.GEOIP_DB_PATH || path.join(geoDir(), "dbip-city-lite.mmdb");

let reader: Reader<CityResponse> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;
let lastAttempt = 0;

async function download(target: string) {
  mkdirSync(path.dirname(target), { recursive: true });
  const now = new Date();
  // the new month's file appears during its first days: fall back a month
  const months = [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  for (const m of months) {
    const url = `https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok || !res.body) continue;
    const tmp = `${target}.download`;
    await pipeline(Readable.fromWeb(res.body as never), createGunzip(), createWriteStream(tmp));
    renameSync(tmp, target);
    console.log(`[analytics] geolocation database updated (DB-IP ${m})`);
    return;
  }
  throw new Error("DB-IP download failed");
}

async function load() {
  const file = dbPath();
  const auto = process.env.GEOIP_AUTO_DOWNLOAD !== "off" && !process.env.GEOIP_DB_PATH;
  const stale = !existsSync(file) || Date.now() - statSync(file).mtimeMs > MAX_AGE_MS;
  if (stale && auto) {
    try {
      await download(file);
    } catch (e) {
      try {
        unlinkSync(`${file}.download`);
      } catch {}
      console.error("[analytics] geolocation download failed:", e instanceof Error ? e.message : e);
    }
  }
  if (!existsSync(file)) return;
  const mtime = statSync(file).mtimeMs;
  if (reader && mtime <= loadedAt) return;
  reader = new Reader<CityResponse>(await readFile(file));
  loadedAt = mtime;
}

/** Load (or refresh) the database in the background; lookups never wait for it. */
function ensure() {
  if (loading) return;
  const due = !reader ? Date.now() - lastAttempt > 3600_000 : Date.now() - loadedAt > MAX_AGE_MS && Date.now() - lastAttempt > 3600_000;
  if (!due) return;
  lastAttempt = Date.now();
  loading = load()
    .catch((e) => console.error("[analytics] geolocation database unreadable:", e instanceof Error ? e.message : e))
    .finally(() => {
      loading = null;
    });
}

/** Start loading at boot so the first visitors already get a location. */
export function warmGeo() {
  ensure();
}

const PRIVATE_IP = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd|fe80)/i;

export function lookupGeo(ip: string | null, headers?: Headers): GeoInfo {
  ensure();
  const cf = headers?.get("cf-ipcountry");
  const cfCountry = cf && /^[A-Z]{2}$/.test(cf) && cf !== "XX" && cf !== "T1" ? cf : null;
  const out: GeoInfo = { country: cfCountry, region: null, city: null };
  if (!ip || PRIVATE_IP.test(ip) || !reader) return out;
  try {
    const r = reader.get(ip.replace(/^::ffff:/, ""));
    if (!r) return out;
    out.country = r.country?.iso_code ?? out.country;
    out.city = r.city?.names?.en ?? null;
    out.region = r.subdivisions?.[0]?.names?.en ?? null;
  } catch {
    // malformed address
  }
  return out;
}
