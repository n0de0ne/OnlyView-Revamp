import "server-only";
import { prisma } from "./db";
import { DEFAULT_LOCALE, getDict, isLocale, LOCALES, tpl, type Dict, type Locale } from "./i18n";
import { getRateConfig, getSettings } from "./settings";
import { VILLA, type VillaFacts } from "./site-facts";

/**
 * The site's copy, stored in the database (Admin → Textes du site).
 *
 * Each block below is a path in the dictionary (`lib/i18n/en.ts`, `fr.ts`):
 * the text found there is only the block's *initial* value, written once to
 * the SiteText table by `seedSiteTexts()` at server start. From then on the
 * database row is what the site shows, so changing copy means editing it in
 * the admin, not in the code. The interface itself (buttons, form labels,
 * error messages, the guest portal) stays in the dictionary.
 *
 * `pick` limits a block to some fields of a dictionary section that also
 * holds interface labels (the map's buttons, the gallery's arrows…).
 */
export interface ContentBlockDef {
  key: string;
  group: string;
  label: string;
  help?: string;
  pick?: string[];
  /** one value for both languages (the villa's facts) */
  shared?: boolean;
}

export const CONTENT_GROUPS: Array<{ id: string; label: string }> = [
  { id: "home", label: "Accueil" },
  { id: "villa", label: "La villa" },
  { id: "pointe-milou", label: "Pointe Milou" },
  { id: "map", label: "Carte de l'île" },
  { id: "tour", label: "Visite & galerie" },
  { id: "rates", label: "Tarifs" },
  { id: "faq", label: "FAQ" },
  { id: "direct", label: "Réserver en direct" },
  { id: "guide", label: "Guide" },
  { id: "contact", label: "Contact & avis" },
  { id: "seo", label: "Google (titres & descriptions)" },
  { id: "emails", label: "Emails aux clients" },
  { id: "contract", label: "Contrat" },
];

const EMAIL_HELP =
  "Entre accolades : rempli automatiquement pour chaque client. Un paragraphe qui ne contient que {button}, {details}, {bank}… est remplacé par le bouton ou le tableau correspondant.";

export const CONTENT_BLOCKS: ContentBlockDef[] = [
  // home
  { key: "hero", group: "home", label: "Bandeau d'accueil" },
  { key: "badges", group: "home", label: "Badges sous le bandeau" },
  { key: "intro", group: "home", label: "Présentation" },
  { key: "spaces", group: "home", label: "Espaces de vie" },
  { key: "amenities", group: "home", label: "Équipements" },
  { key: "testimonials", group: "home", label: "Section avis" },
  { key: "ratesTeaser", group: "home", label: "Aperçu des tarifs" },
  { key: "location", group: "home", label: "Emplacement" },
  { key: "goldenHour", group: "home", label: "Golden hour", help: "Les moments sont des heures décimales (17.95 = 17 h 57)." },
  { key: "cta", group: "home", label: "Appel à réserver (bas de page)" },
  { key: "footer", group: "home", label: "Pied de page", pick: ["tagline", "directBadge"] },
  // villa
  {
    key: "villa",
    group: "villa",
    label: "Fiche de la villa",
    shared: true,
    help: "Chiffres et faits repris par Google, les IA (llms.txt), la carte et les pages. Durée minimum, acompte et taxe se règlent dans Réglages → Tarifs.",
  },
  { key: "seo", group: "villa", label: "Chiffres clés (tableau)" },
  { key: "nearby", group: "villa", label: "Autour de la villa" },
  // Pointe Milou
  { key: "pointeMilou", group: "pointe-milou", label: "Page Pointe Milou" },
  // map
  {
    key: "map",
    group: "map",
    label: "Textes de la carte",
    pick: [
      "label", "title", "text", "exploreLabel", "exploreTitle", "intro", "directoryIntro",
      "beachesTitle", "beachesByUse", "beachUses", "gettingAround", "gettingAroundText", "gettingAroundTips",
      "ctaLabel", "ctaTitle", "ctaText", "ctaButton", "areasTitle", "areasIntro", "areas", "faqTitle", "faq",
    ],
  },
  // tour & gallery
  { key: "tour", group: "tour", label: "Visite virtuelle" },
  { key: "galleryIntro", group: "tour", label: "Introduction de la galerie" },
  { key: "gallery", group: "tour", label: "Catégories de photos", pick: ["categories"] },
  // rates
  {
    key: "rates",
    group: "rates",
    label: "Page tarifs",
    pick: ["title", "intro", "introNoLoyalty", "holidayTitle", "holidayNote", "specialTitle", "minStay", "tax", "deposit", "seasonNames"],
  },
  // FAQ
  { key: "faq", group: "faq", label: "Questions fréquentes", help: "Les questions marquées « loyalty » sont masquées quand le programme de fidélité est désactivé." },
  // direct
  { key: "whyDirect", group: "direct", label: "Pourquoi réserver en direct" },
  { key: "compare", group: "direct", label: "Direct ou agence (tableau)" },
  // guide
  { key: "guideIntro", group: "guide", label: "Introduction du guide" },
  { key: "guideHub", group: "guide", label: "St Barth en bref" },
  // contact & reviews
  { key: "contact", group: "contact", label: "Page contact", pick: ["title", "intro"] },
  { key: "contactOwner", group: "contact", label: "La propriétaire" },
  { key: "reviews", group: "contact", label: "Page avis", pick: ["title", "intro"] },
  // SEO
  { key: "meta", group: "seo", label: "Titres et descriptions des pages" },
  // guest emails
  ...(
    [
      ["bookingRequestAck", "Demande de réservation reçue", "{name} {checkIn} {checkOut} {bedrooms} {guests}"],
      ["bookingConfirmed", "Réservation confirmée", "{name} · {details} = tableau du séjour"],
      ["magicLink", "Lien de connexion à l'espace client", "{name} · {button}"],
      ["portalAccess", "Accès à l'espace client (envoyé depuis la réservation)", "{name} · {button}"],
      ["contractRequest", "Contrat à signer", "{name} {checkIn} {checkOut} · {button}"],
      ["amendmentRequest", "Avenant à signer (changement de dates)", "{name} {checkIn} {checkOut} {previousCheckIn} {previousCheckOut} · {button}"],
      ["contractSigned", "Contrat signé (copie au client)", "{name} {checkIn} {checkOut} · {summary} = tableau des montants. Le client reçoit les deux langues."],
      ["optionExpiring", "Rappel : l'option expire", "{name} {stay} {expires} · {button}"],
      ["balanceReminder", "Rappel du solde", "{name} {stay} {amount} {due} · {bank} = coordonnées bancaires · {button}"],
      ["preArrival", "Avant l'arrivée", "{name} {stay} · {arrivalDetails} = l'un des deux textes ci-dessous · {practical} = adresse, WhatsApp, horaires · {button}"],
      ["reviewRequest", "Demande d'avis après le séjour", "{name} · {button}"],
      ["dateChangeApproved", "Changement de dates accepté", "{name} {from} {to} {amount} · {note} = votre message · {amendment} = texte + bouton de l'avenant · {button}"],
      ["dateChangeRejected", "Changement de dates refusé", "{name} {from} {to} · {note} = votre message · {button}"],
      ["conciergeAnswer", "Réponse à une demande de conciergerie", "{name} {verdict} {status} · {request} = la demande · {note} = votre message · {otherOption} si non confirmée · {button}"],
    ] as const
  ).map(([k, label, vars]) => ({ key: `emails.${k}`, group: "emails", label, help: `${vars}. ${EMAIL_HELP}` })),
  // the rental agreement
  {
    key: "contractText",
    group: "contract",
    label: "Texte du contrat de location",
    help: "Entre accolades : {owner} {tenant} {checkIn} {checkOut} {nights} {bedrooms} {guests} {totalAmount} {depositAmount} {balanceAmount} {date}. Les montants, l'échéancier et les coordonnées bancaires sont ajoutés automatiquement. Un contrat déjà envoyé ou signé garde le texte avec lequel il a été émis.",
  },
];

/** Values the copy can quote, filled from Réglages and the villa's facts. */
export const CONTENT_PLACEHOLDERS: Record<string, string> = {
  deposit: "acompte (%)",
  tax: "taxe de séjour (%)",
  minStay: "durée minimum (nuits)",
  minStayFestive: "durée minimum Noël / Nouvel An (nuits)",
  balanceDays: "solde dû (jours avant l'arrivée)",
  checkin: "heure d'arrivée",
  checkout: "heure de départ",
};

const SHARED = "all";

/* ───────────────────────── shapes ───────────────────────── */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const isObj = (v: unknown): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), obj);
}

/** The block's value as shipped in the code, for one language. */
export function blockDefault(block: ContentBlockDef, locale: Locale): Json {
  if (block.key === "villa") return villaSeed() as unknown as Json;
  const value = getPath(getDict(locale), block.key) as Json;
  if (!block.pick || !isObj(value)) return value;
  return Object.fromEntries(block.pick.filter((k) => k in value).map((k) => [k, value[k]]));
}

/** Rows of an array of [a, b] pairs (or any fixed-length tuple). */
const isTupleList = (def: Json[]) => def.length > 0 && def.every(Array.isArray);

/** Keys every item of a list of objects carries, and keys some items carry. */
function itemKeys(def: Json[]) {
  const objs = def.filter(isObj);
  const all = new Set(objs.flatMap((o) => Object.keys(o)));
  const required = [...all].filter((k) => objs.every((o) => k in o));
  return { all, required };
}

/** Does `value` have the shape of the shipped value `def`? */
export function conforms(value: unknown, def: Json): boolean {
  if (typeof def === "string") return typeof value === "string";
  if (typeof def === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof def === "boolean") return typeof value === "boolean";
  if (Array.isArray(def)) {
    if (!Array.isArray(value)) return false;
    if (def.length === 0) return value.every((v) => typeof v === "string");
    if (isTupleList(def)) {
      const row = def[0] as Json[];
      return value.every((v) => Array.isArray(v) && v.length === row.length && v.every((x, i) => conforms(x, row[i])));
    }
    if (def.every(isObj)) {
      const { all, required } = itemKeys(def);
      const sample = (k: string) => (def as Array<Record<string, Json>>).find((o) => k in o)![k];
      return value.every(
        (v) =>
          isObj(v) &&
          required.every((k) => k in v) &&
          Object.entries(v).every(([k, x]) => all.has(k) && conforms(x, sample(k)))
      );
    }
    return value.every((v) => conforms(v, def[0]));
  }
  if (isObj(def)) {
    return isObj(value) && Object.entries(def).every(([k, d]) => conforms(value[k], d));
  }
  return value === def;
}

/** `value` where it has the right shape, the shipped value elsewhere (a field added in code later). */
function coerce(value: unknown, def: Json): Json {
  if (isObj(def)) {
    if (!isObj(value)) return def;
    return Object.fromEntries(Object.entries(def).map(([k, d]) => [k, coerce(value[k], d)]));
  }
  return conforms(value, def) ? (value as Json) : def;
}

function fill(value: Json, vars: Record<string, string | number>): Json {
  if (typeof value === "string") return tpl(value, vars);
  if (Array.isArray(value)) return value.map((v) => fill(v, vars));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]));
  return value;
}

/* ───────────────────────── the villa ───────────────────────── */

/**
 * The facts the owner edits, as shipped. Not in it: the GPS point (Réglages →
 * Contact, shared with the map's itineraries), the balance deadline (a rule
 * the contracts apply) and minimum stays, deposit and tax (Réglages → Tarifs).
 */
function villaSeed() {
  const { lat: _lat, lng: _lng, balanceDaysBefore: _b, ...facts } = VILLA;
  return JSON.parse(JSON.stringify(facts)) as Omit<VillaFacts, "lat" | "lng" | "balanceDaysBefore">;
}

let villaSnapshot: VillaFacts = { ...VILLA };

/**
 * The villa's facts as last read from the database. For the JSON-LD and
 * metadata helpers that run synchronously; every public page loads the
 * content (and so refreshes this) before rendering.
 */
export function villaFacts(): VillaFacts {
  return villaSnapshot;
}

/* ───────────────────────── reading ───────────────────────── */

type Loaded = { at: number; rows: Map<string, Json>; vars: Record<string, string | number> };
let loaded: Loaded | null = null;
const dicts = new Map<Locale, Dict>();
const TTL = 30_000;

async function load(): Promise<Loaded> {
  if (loaded && Date.now() - loaded.at < TTL) return loaded;
  const rows = new Map<string, Json>();
  let ok = true;
  try {
    for (const r of await prisma.siteText.findMany()) rows.set(`${r.key}|${r.locale}`, r.value as Json);
  } catch {
    ok = false; // no database (image build): the shipped text serves, uncached
  }
  const [rates, settings] = await Promise.all([getRateConfig(), getSettings()]);
  const coord = (v: string | undefined, fallback: number) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : fallback;
  };
  villaSnapshot = {
    ...(coerce(rows.get(`villa|${SHARED}`), villaSeed() as unknown as Json) as unknown as VillaFacts),
    lat: coord(settings.villa_lat, VILLA.lat),
    lng: coord(settings.villa_lng, VILLA.lng),
    balanceDaysBefore: VILLA.balanceDaysBefore,
  };
  const pct = (n: number) => Math.round(n * 1000) / 10;
  const vars = {
    deposit: pct(rates.depositPercent),
    tax: pct(rates.taxRate),
    minStay: rates.minStay,
    minStayFestive: rates.minStayPeak,
    balanceDays: villaSnapshot.balanceDaysBefore,
    checkin: villaSnapshot.checkin,
    checkout: villaSnapshot.checkout,
  };
  const next = { at: ok ? Date.now() : 0, rows, vars };
  dicts.clear();
  if (ok) loaded = next;
  return next;
}

/** The villa's facts, fresh from the database. */
export async function getVilla(): Promise<VillaFacts> {
  await load();
  return villaSnapshot;
}

/**
 * The dictionary for `locale` with the site's copy from the database: what
 * every public page renders. Interface labels come from the code as before.
 */
export async function getContent(locale: string): Promise<Dict> {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const data = await load();
  const cached = data === loaded ? dicts.get(loc) : undefined;
  if (cached) return cached;

  const dict = JSON.parse(JSON.stringify(getDict(loc))) as Record<string, Json>;
  for (const block of CONTENT_BLOCKS) {
    if (block.shared) continue;
    const def = blockDefault(block, loc);
    const value = fill(coerce(data.rows.get(`${block.key}|${loc}`), def), data.vars);
    const parts = block.key.split(".");
    const parent = parts.slice(0, -1).reduce((o, k) => o[k] as Record<string, Json>, dict);
    const last = parts.at(-1)!;
    if (block.pick && isObj(value) && isObj(parent[last])) Object.assign(parent[last] as object, value);
    else parent[last] = value;
  }
  const result = dict as unknown as Dict;
  if (data === loaded) dicts.set(loc, result);
  return result;
}

export function invalidateContent() {
  loaded = null;
  dicts.clear();
}

/** When the copy last changed — sitemap lastmod and dateModified. */
export async function contentUpdatedAt(): Promise<string | null> {
  try {
    const row = await prisma.siteText.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
    return row ? row.updatedAt.toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

/* ───────────────────────── admin ───────────────────────── */

export const findBlock = (key: string) => CONTENT_BLOCKS.find((b) => b.key === key);
export const blockLocales = (block: ContentBlockDef): string[] => (block.shared ? [SHARED] : LOCALES);

const localeDefault = (block: ContentBlockDef, locale: string) =>
  blockDefault(block, (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale);

/** Every block with its stored value per language and the shipped one (for "back to the original"). */
export async function listContentBlocks() {
  const rows = await prisma.siteText.findMany();
  const byId = new Map(rows.map((r) => [`${r.key}|${r.locale}`, r]));
  return CONTENT_BLOCKS.map((block) => ({
    ...block,
    values: Object.fromEntries(
      blockLocales(block).map((locale) => {
        const def = localeDefault(block, locale);
        const row = byId.get(`${block.key}|${locale}`);
        return [
          locale,
          {
            value: coerce(row?.value, def),
            original: def,
            updatedAt: row?.updatedAt ?? null,
            updatedBy: row?.updatedBy ?? null,
          },
        ];
      })
    ),
  }));
}

export async function saveContentBlock(key: string, locale: string, value: unknown, username: string) {
  const block = findBlock(key);
  if (!block || !blockLocales(block).includes(locale)) return "unknown_block";
  if (!conforms(value, localeDefault(block, locale))) return "invalid_shape";
  const json = value as object;
  await prisma.siteText.upsert({
    where: { key_locale: { key, locale } },
    create: { key, locale, value: json, updatedBy: username },
    update: { value: json, updatedBy: username },
  });
  invalidateContent();
  return null;
}

/**
 * A draft value as the site would use it (shape checked, Réglages filled in),
 * for the admin's preview before saving. Null when the shape is wrong.
 */
export async function previewContentBlock(key: string, locale: string, value: unknown): Promise<Json | null> {
  const block = findBlock(key);
  if (!block || !blockLocales(block).includes(locale)) return null;
  if (!conforms(value, localeDefault(block, locale))) return null;
  return fill(value as Json, (await load()).vars);
}

/**
 * Write the shipped copy of every block that has no row yet. Runs at server
 * start; a block already in the database is never touched, so the owner's
 * edits stay, and a block added to the code later is seeded on the next start.
 */
export async function seedSiteTexts(): Promise<number> {
  const data = CONTENT_BLOCKS.flatMap((block) =>
    blockLocales(block).map((locale) => ({ key: block.key, locale, value: localeDefault(block, locale) as object }))
  );
  const { count } = await prisma.siteText.createMany({ data, skipDuplicates: true });
  if (count) invalidateContent();
  return count;
}
