import "server-only";
import type { z } from "zod";
import { prisma } from "./db";
import { BoatInput, ChefOfferInput, ServicePartnerInput, TaxiInput } from "./admin-schemas";
import type { Locale } from "./i18n";

/* ───────────────────────── admin catalog ───────────────────────── */

/** The concierge catalogs the admin edits through /api/admin/concierge/<type>. */
export const CONCIERGE_TYPES = ["partners", "taxis", "boats", "chef-offers"] as const;
export type ConciergeType = (typeof CONCIERGE_TYPES)[number];

export const isConciergeType = (s: string): s is ConciergeType =>
  (CONCIERGE_TYPES as readonly string[]).includes(s);

export const conciergeSchema = {
  partners: ServicePartnerInput,
  taxis: TaxiInput,
  boats: BoatInput,
  "chef-offers": ChefOfferInput,
} satisfies Record<ConciergeType, z.ZodTypeAny>;

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

async function freeSlug(name: string, taken: (slug: string) => Promise<unknown>) {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function listConcierge(type: ConciergeType) {
  switch (type) {
    case "partners":
      return prisma.servicePartner.findMany({
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        include: { _count: { select: { boats: true, chefOffers: true } } },
      });
    case "taxis":
      return prisma.taxi.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    case "boats":
      return prisma.boat.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    case "chef-offers":
      return prisma.chefOffer.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }
}

/** `data` has been parsed with conciergeSchema[type]. */
export async function createConcierge(type: ConciergeType, data: Record<string, unknown>) {
  switch (type) {
    case "partners":
      return prisma.servicePartner.create({ data: data as z.infer<typeof ServicePartnerInput> });
    case "taxis":
      return prisma.taxi.create({ data: data as z.infer<typeof TaxiInput> });
    case "boats": {
      const d = data as z.infer<typeof BoatInput>;
      const slug = await freeSlug(d.name, (slug) => prisma.boat.findUnique({ where: { slug } }));
      return prisma.boat.create({ data: { ...d, slug } });
    }
    case "chef-offers": {
      const d = data as z.infer<typeof ChefOfferInput>;
      const slug = await freeSlug(d.name, (slug) => prisma.chefOffer.findUnique({ where: { slug } }));
      return prisma.chefOffer.create({ data: { ...d, slug } });
    }
  }
}

export async function updateConcierge(type: ConciergeType, id: number, data: Record<string, unknown>) {
  switch (type) {
    case "partners":
      return prisma.servicePartner.update({ where: { id }, data });
    case "taxis":
      return prisma.taxi.update({ where: { id }, data });
    case "boats":
      return prisma.boat.update({ where: { id }, data });
    case "chef-offers":
      return prisma.chefOffer.update({ where: { id }, data });
  }
}

export async function deleteConcierge(type: ConciergeType, id: number) {
  switch (type) {
    case "partners":
      return prisma.servicePartner.delete({ where: { id } });
    case "taxis":
      return prisma.taxi.delete({ where: { id } });
    case "boats":
      return prisma.boat.delete({ where: { id } });
    case "chef-offers":
      return prisma.chefOffer.delete({ where: { id } });
  }
}

/* ───────────────────────── guest portal ───────────────────────── */

/** Boat outings a guest can ask for, and the price column each reads. */
export const BOAT_OUTINGS = [
  { key: "half_day", field: "priceHalfDay" },
  { key: "full_day", field: "priceFullDay" },
  { key: "sunset", field: "priceSunset" },
  { key: "cruising_day", field: "priceCruisingDay" },
  { key: "transfer", field: "priceTransfer" },
  { key: "sbh_sxm_day", field: "transferSbhSxmDay" },
  { key: "sbh_sxm_night", field: "transferSbhSxmNight" },
  { key: "sxm_sbh_day", field: "transferSxmSbhDay" },
  { key: "sxm_sbh_night", field: "transferSxmSbhNight" },
  { key: "anguilla", field: "transferAnguilla" },
] as const;
export type BoatOuting = (typeof BOAT_OUTINGS)[number]["key"];

/**
 * Everything the portal's concierge offers, in the guest's language. A
 * provider switched off in admin takes its boats / menus with it.
 */
export async function getConciergeCatalog(locale: Locale) {
  const fr = locale === "fr";
  const pick = (en: string | null, frText: string | null) => (fr ? frText ?? en : en ?? frText);
  const activePartner = { OR: [{ partnerId: null }, { partner: { isActive: true } }] };

  const [restaurants, boats, chef, taxis] = await Promise.all([
    prisma.mapPlace.findMany({
      where: { category: "restaurant", isActive: true, bookingMode: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.boat.findMany({
      where: { isActive: true, ...activePartner },
      include: { partner: { select: { currency: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.chefOffer.findMany({
      where: { isActive: true, ...activePartner },
      include: { partner: { select: { name: true, currency: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.taxi.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    restaurants: restaurants.map((r) => ({
      id: r.id,
      /** its pin on the island map */
      slug: r.slug,
      name: r.name,
      zone: r.zone,
      kind: r.kind,
      cuisine: pick(r.cuisineEn, r.cuisineFr),
      description: pick(r.descriptionEn, r.descriptionFr),
      priceRange: r.priceRange,
      imageUrl: r.imageUrl,
      bookingMode: r.bookingMode as "concierge" | "direct" | "none",
      bookingUrl: r.bookingUrl,
      /** the online booking system behind bookingUrl, if one we know */
    })),
    boats: boats.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.boatType,
      capacity: b.capacity,
      length: b.length,
      description: pick(b.descriptionEn, b.descriptionFr),
      includes: pick(b.includesEn, b.includesFr),
      imageUrl: b.imageUrl,
      currency: b.partner?.currency ?? "EUR",
      outings: BOAT_OUTINGS.filter((o) => b[o.field] != null).map((o) => ({
        key: o.key as BoatOuting,
        price: b[o.field] as number,
      })),
    })),
    chef: chef.map((o) => ({
      id: o.id,
      name: o.name,
      category: o.category,
      formula: o.formulaName,
      description: pick(o.descriptionEn, o.descriptionFr),
      menu: pick(o.menuEn, o.menuFr),
      price: o.price,
      priceType: o.priceType,
      minimumGuests: o.minimumGuests,
      duration: o.duration,
      imageUrl: o.imageUrl,
      currency: o.partner?.currency ?? "EUR",
    })),
    taxis: taxis.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      displayPhone: t.displayPhone ?? t.phone,
      zone: t.zone,
      hasWhatsapp: t.hasWhatsapp,
    })),
  };
}

export type ConciergeCatalog = Awaited<ReturnType<typeof getConciergeCatalog>>;

export const money = (n: number, currency: string) =>
  (currency === "EUR" ? "€" : "$") + Math.round(n).toLocaleString("en-US");
