import { prisma } from "./db";

/**
 * Daily mirror of St Barth Provider's rental catalog into Extras.
 *
 * Source: their booking site (booking.stbarthprovider.com) — the shop guests
 * actually pay through, with a stable id per product and both languages. Its
 * prices are what they charge; the Wix "catalog-1" page lags behind it.
 *
 * Each run reads every category in EN and FR, then for the provider's items:
 * new products are created (active, guest-bookable), existing ones get the
 * site's name, category, price, photo and order, products gone from the site
 * are hidden (isActive false, never deleted: stays keep their lines), and a
 * product that comes back is shown again. The site has almost no
 * descriptions, so ours are only replaced when it has one. guestBookable stays
 * the admin's call.
 *
 * Any fetch or parse problem aborts the whole run before a single write, so a
 * site outage or redesign can never wipe the catalog; the outcome of every run
 * is kept in the setting below and shown in Admin → Extras.
 */

export const SB_PROVIDER_BASE = "https://booking.stbarthprovider.com";
export const EXTRAS_SYNC_KEY = "extras_sync_sb_provider";
const PARTNER = { kind: "extras", name: "St Barth Provider" };
const REF = "sbp:";

export interface ProviderProduct {
  id: number;
  nameEn: string;
  nameFr: string;
  categoryEn: string;
  categoryFr: string;
  /** EUR per day; 0 = price on request */
  price: number | null;
  imageUrl: string | null;
  descriptionEn: string | null;
  descriptionFr: string | null;
}

export interface ExtrasSyncStatus {
  lastRunAt: string;
  ok: boolean;
  error?: string;
  lastSuccessAt?: string;
  source: string;
  items?: number;
  created?: number;
  updated?: number;
  hidden?: number;
  /** a few human-readable lines on what the last successful run changed */
  changes?: string[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const text = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : ENTITIES[e.toLowerCase()] ?? m
    )
    .replace(/[ \t]+/g, " ")
    .trim();

/** "BABY BEACH CHAIR" → "Baby beach chair", "paddle board" → "Paddle board"; other casings kept */
const tidyName = (s: string) => {
  const t = s.length > 3 && s === s.toUpperCase() ? s.toLowerCase() : s;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** "50€/DAY" → 50 · "Price on request" / "Prix sur demande" → 0 · anything else → null */
export function parsePrice(s: string): number | null {
  const m = s.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)€/);
  if (m) return parseFloat(m[1].replace(",", "."));
  return /request|demande/i.test(s) ? 0 : null;
}

async function get(path: string): Promise<string> {
  const res = await fetch(SB_PROVIDER_BASE + path, {
    headers: { "User-Agent": "OnlyView villa catalog sync (onlyviewstbarth.com)", Accept: "text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status !== 200) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

/** The category menu: [[id, name]] in the site's order. */
export function parseCategories(html: string, lang: "en" | "fr"): Array<[number, string]> {
  const seen = new Map<number, string>();
  const re = new RegExp(`href="/${lang}/customer-bookings/category/(\\d+)"[^>]*>([^<]+)</a>`, "g");
  for (const m of html.matchAll(re)) if (!seen.has(+m[1])) seen.set(+m[1], text(m[2]));
  return [...seen];
}

/**
 * The product photo of a card: the first <img> that isn't the site's logo,
 * whether its src is relative or absolute (or lazy-loaded in data-src).
 */
export function productImage(card: string): string | null {
  for (const tag of card.match(/<img\b[^>]*>/gi) ?? []) {
    const src = tag.match(/\s(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (!src || /logo|theme_stbarth|^data:/i.test(src)) continue;
    try {
      return new URL(text(src), SB_PROVIDER_BASE + "/").href;
    } catch {
      continue;
    }
  }
  return null;
}

/** Product cards of a category page, in order. */
export function parseCategory(html: string, lang: "en" | "fr") {
  return html
    .split(/class="col-lg-4 col-12 d-flex mt-4 mb-2/)
    .slice(1)
    .map((card) => {
      const id = card.match(new RegExp(`/${lang}/customer-bookings/view/(\\d+)`))?.[1];
      const name = card.match(/title_article_cat[^>]*>([\s\S]*?)<\/h4>/)?.[1];
      const price = card.match(/text_grey m-0 text-center">([\s\S]*?)<\/p>/)?.[1];
      const img = productImage(card);
      if (!id || !name) return null;
      return {
        id: +id,
        name: tidyName(text(name)),
        price: price ? parsePrice(text(price)) : null,
        imageUrl: img,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

/** The free text under "Description" on a product page ("" when there is none). */
export function parseDescription(html: string): string | null {
  const m = html.match(/view_size_text text_bold">Description<\/p>\s*<p class="text_bold">([\s\S]*?)<\/p>/);
  return m ? text(m[1]) : null;
}

/** Read the whole catalog. Throws on anything that doesn't look right. */
export async function fetchProviderCatalog(): Promise<ProviderProduct[]> {
  const [homeEn, homeFr] = await Promise.all([get("/en"), get("/fr")]);
  const catsEn = parseCategories(homeEn, "en");
  const catsFr = new Map(parseCategories(homeFr, "fr"));
  if (catsEn.length < 3) throw new Error(`only ${catsEn.length} categories found on the site`);

  const products = new Map<number, ProviderProduct>();
  for (const [catId, catEn] of catsEn) {
    const [en, fr] = await Promise.all([
      get(`/en/customer-bookings/category/${catId}`).then((h) => parseCategory(h, "en")),
      get(`/fr/customer-bookings/category/${catId}`).then((h) => parseCategory(h, "fr")),
    ]);
    if (!en.length) throw new Error(`category "${catEn}" has no products the sync can read`);
    const frById = new Map(fr.map((p) => [p.id, p]));
    for (const p of en) {
      if (products.has(p.id)) continue; // listed in two categories: the first one wins
      products.set(p.id, {
        id: p.id,
        nameEn: p.name,
        nameFr: frById.get(p.id)?.name || p.name,
        categoryEn: catEn,
        categoryFr: catsFr.get(catId) || catEn,
        price: p.price ?? frById.get(p.id)?.price ?? null,
        imageUrl: p.imageUrl ?? frById.get(p.id)?.imageUrl ?? null,
        descriptionEn: null,
        descriptionFr: null,
      });
    }
  }

  // descriptions live on each product page: best effort, a few at a time
  const list = [...products.values()];
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(
      list.slice(i, i + 6).map(async (p) => {
        const [en, fr] = await Promise.all(
          (["en", "fr"] as const).map((l) =>
            get(`/${l}/customer-bookings/view/${p.id}`).then(parseDescription, () => null)
          )
        );
        p.descriptionEn = en || null;
        p.descriptionFr = fr || null;
      })
    );
  }
  return list;
}

/** "Pack N' Play Crib" ~ "Pack n play crib" — to adopt items imported before the sync existed */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

let running: Promise<ExtrasSyncStatus> | null = null;

/** One sync run (concurrent calls share it). Never throws. */
export function syncProviderExtras(): Promise<ExtrasSyncStatus> {
  running ??= run().finally(() => (running = null));
  return running;
}

export async function getExtrasSyncStatus(): Promise<ExtrasSyncStatus | null> {
  const row = await prisma.setting.findUnique({ where: { key: EXTRAS_SYNC_KEY } });
  try {
    return row ? (JSON.parse(row.value) as ExtrasSyncStatus) : null;
  } catch {
    return null;
  }
}

async function saveStatus(s: ExtrasSyncStatus) {
  const value = JSON.stringify(s);
  await prisma.setting.upsert({ where: { key: EXTRAS_SYNC_KEY }, update: { value }, create: { key: EXTRAS_SYNC_KEY, value } });
}

async function run(): Promise<ExtrasSyncStatus> {
  const previous = await getExtrasSyncStatus().catch(() => null);
  const lastRunAt = new Date().toISOString();
  try {
    const status = await apply(await fetchProviderCatalog(), !previous?.lastSuccessAt);
    const s: ExtrasSyncStatus = { lastRunAt, ok: true, lastSuccessAt: lastRunAt, source: SB_PROVIDER_BASE, ...status };
    await saveStatus(s);
    if (s.created || s.updated || s.hidden)
      console.log(`[extras-sync] ${s.items} products: ${s.created} new, ${s.updated} updated, ${s.hidden} hidden`);
    return s;
  } catch (e) {
    const s: ExtrasSyncStatus = {
      ...(previous ?? {}),
      lastRunAt,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      source: SB_PROVIDER_BASE,
    };
    console.error("[extras-sync] skipped, catalog left unchanged:", s.error);
    await saveStatus(s).catch(() => {});
    return s;
  }
}

async function apply(products: ProviderProduct[], firstRun: boolean) {
  const partner = await prisma.servicePartner.upsert({
    where: { kind_name: PARTNER },
    update: {},
    create: {
      ...PARTNER,
      phone: "+590 690 76 47 58",
      email: "reservation@stbarthprovider.com",
      website: "https://www.stbarthprovider.com",
      notes: "Location de matériel (bébé, couchage, piscine, plage, sport, fête). Prix en € par jour.",
      currency: "EUR",
    },
  });
  const existing = await prisma.extra.findMany({ where: { partnerId: partner.id } });

  // a much shorter list than what we mirror today is a broken page, not a clearance sale
  const mirrored = existing.filter((x) => x.externalRef?.startsWith(REF) && x.isActive).length;
  if (mirrored >= 10 && products.length < mirrored / 2)
    throw new Error(`only ${products.length} products read (${mirrored} shown today)`);

  const byRef = new Map(existing.filter((x) => x.externalRef).map((x) => [x.externalRef!, x]));
  // first run: adopt the items imported from the catalog page by name, exact then partial
  const legacy = existing.filter((x) => !x.externalRef);
  const adopted = new Map<number, (typeof existing)[number]>();
  if (legacy.length) {
    const free = products.filter((p) => !byRef.has(REF + p.id));
    for (const pass of ["exact", "partial"] as const)
      for (const p of free) {
        if (adopted.has(p.id)) continue;
        const n = norm(p.nameEn);
        const hit = legacy.find(
          (x) =>
            ![...adopted.values()].includes(x) &&
            (pass === "exact" ? norm(x.nameEn) === n : norm(x.nameEn).includes(n) || n.includes(norm(x.nameEn)))
        );
        if (hit) adopted.set(p.id, hit);
      }
  }

  const changes: string[] = [];
  let created = 0;
  let updated = 0;
  let hidden = 0;
  const ops = [];
  const seen = new Set<number>();

  for (const [i, p] of products.entries()) {
    const ref = REF + p.id;
    const row = byRef.get(ref) ?? adopted.get(p.id);
    const data = {
      nameEn: p.nameEn,
      nameFr: p.nameFr,
      categoryEn: p.categoryEn,
      categoryFr: p.categoryFr,
      // a product the site shows without a photo keeps the one it had
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      sortOrder: 100 + i,
      isActive: true,
      externalRef: ref,
      ...(p.price != null ? { price: p.price } : {}),
      ...(p.descriptionEn ? { descriptionEn: p.descriptionEn } : {}),
      ...(p.descriptionFr ? { descriptionFr: p.descriptionFr } : {}),
    };
    if (!row) {
      ops.push(
        prisma.extra.create({
          data: { ...data, price: p.price ?? 0, unit: "night", partnerId: partner.id, guestBookable: true },
        })
      );
      created++;
      changes.push(`+ ${p.nameFr} (${p.price ? `${p.price} €` : "sur demande"})`);
      continue;
    }
    seen.add(row.id);
    const diff = (Object.keys(data) as Array<keyof typeof data>).filter((k) => row[k] !== data[k]);
    if (!diff.length) continue;
    ops.push(prisma.extra.update({ where: { id: row.id }, data }));
    updated++;
    if (diff.includes("price")) changes.push(`${p.nameFr} : ${row.price} € → ${p.price} €`);
    else if (!row.isActive) changes.push(`↺ ${p.nameFr} de retour`);
  }

  for (const x of existing) {
    if (seen.has(x.id) || !x.isActive) continue;
    // items the admin adds by hand under this provider are left alone, except
    // the old catalog-page import, hidden once if the site no longer has them
    const gone = x.externalRef?.startsWith(REF) || (firstRun && !x.externalRef);
    if (!gone) continue;
    ops.push(prisma.extra.update({ where: { id: x.id }, data: { isActive: false } }));
    hidden++;
    changes.push(`− ${x.nameFr} (plus sur le site)`);
  }

  if (ops.length) await prisma.$transaction(ops);
  return { items: products.length, created, updated, hidden, changes: changes.slice(0, 40) };
}
