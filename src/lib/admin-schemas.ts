import { z } from "zod";

export const ClientInput = z.object({
  firstname: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  email: z.string().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(50).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  language: z.string().max(10).default("en"),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  discountReason: z.string().max(255).nullable().optional(),
  isVip: z.boolean().default(false),
  blacklisted: z.boolean().default(false),
  blacklistReason: z.string().max(255).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  source: z.string().max(50).default("direct"),
});

export const AgencyInput = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).nullable().optional(),
  contactName: z.string().max(100).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(50).nullable().optional(),
  commissionPercent: z.number().min(0).max(100).default(15),
  isActive: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
});

export const ExpenseInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum([
    "jardinier",
    "electricite",
    "eau",
    "menage",
    "piscine",
    "entretien",
    "assurance",
    "taxe",
    "internet",
    "autre",
  ]),
  amount: z.number().min(0),
  currency: z.string().max(3).default("EUR"),
  description: z.string().max(255).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isFixed: z.boolean().default(false),
  frequency: z.enum(["monthly", "bimonthly", "quarterly", "yearly"]).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentDay: z.number().int().min(1).max(28).default(1),
});

export const PromotionInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  discountType: z.enum(["percent", "fixed", "free_nights"]).default("percent"),
  discountValue: z.number().min(0).default(0),
  minNights: z.number().int().min(0).nullable().optional(),
  maxNights: z.number().int().min(0).nullable().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  stayStartFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  stayStartUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  mustIncludeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  promoCode: z.string().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
  firstTimeOnly: z.boolean().default(false),
  showOnWebsite: z.boolean().default(false),
  maxUses: z.number().int().min(0).nullable().optional(),
  combinable: z.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
});

export const UserInput = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9_.-]+$/i),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200).optional(),
  firstname: z.string().max(100).nullable().optional(),
  lastname: z.string().max(100).nullable().optional(),
  role: z.enum(["owner", "manager", "viewer"]).default("viewer"),
  isActive: z.boolean().default(true),
});

export const dateOrNull = (s: string | null | undefined) =>
  s ? new Date(`${s}T00:00:00Z`) : null;

/* ───────────────────────── island map ───────────────────────── */

/** "17,9020772" (French keyboard) is a coordinate too. */
const coord = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
    z.number().min(-max).max(max)
  );

/** Optional link: "kinu-gawa.com" gets its https://; Google image links run long. */
const placeUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? `https://${v.trim()}` : v),
  z.string().trim().url().max(4000).nullable().optional().or(z.literal("").transform(() => null))
);

const WAYPOINTS_RE = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*(\|\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*)*$/;

export const MapPlaceInput = z.object({
  category: z.enum(["beach", "restaurant", "supermarket", "bakery", "pharmacy", "transport", "sport"]),
  kind: z.string().max(30).nullable().optional().or(z.literal("").transform(() => null)),
  name: z.string().trim().min(1).max(150),
  zone: z.string().trim().max(100).nullable().optional().or(z.literal("").transform(() => null)),
  lat: coord(90),
  lng: coord(180),
  descriptionEn: z.string().trim().max(5000).nullable().optional().or(z.literal("").transform(() => null)),
  descriptionFr: z.string().trim().max(5000).nullable().optional().or(z.literal("").transform(() => null)),
  driveMinutes: z.number().int().min(0).max(600).nullable().optional(),
  /** "lat,lng|lat,lng" — the via-points of the drive from the villa */
  waypoints: z
    .string()
    .trim()
    .max(1000)
    .regex(WAYPOINTS_RE)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  walkFromLastWaypoint: z.boolean().default(false),
  website: placeUrl,
  phone: z.string().trim().max(50).nullable().optional().or(z.literal("").transform(() => null)),
  /* restaurants — what the guest portal's concierge shows */
  cuisineEn: z.string().trim().max(100).nullable().optional().or(z.literal("").transform(() => null)),
  cuisineFr: z.string().trim().max(100).nullable().optional().or(z.literal("").transform(() => null)),
  priceRange: z.number().int().min(1).max(4).nullable().optional(),
  imageUrl: placeUrl,
  bookingMode: z.enum(["concierge", "direct", "none"]).nullable().optional(),
  bookingUrl: placeUrl,
  whatsapp: z.string().trim().max(50).nullable().optional().or(z.literal("").transform(() => null)),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  sortOrder: z.number().int().min(-100000).max(100000).default(0),
  isActive: z.boolean().default(true),
});

/* ───────────────────────── date pricing ───────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RatePeriodInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    /** first night */
    startDate: z.string().regex(ISO_DATE),
    /** last night (inclusive) */
    endDate: z.string().regex(ISO_DATE),
    mode: z.enum(["fixed", "percent"]).default("fixed"),
    rate2: z.number().min(0).nullable().optional(),
    rate3: z.number().min(0).nullable().optional(),
    rate4: z.number().min(0).nullable().optional(),
    adjustPercent: z.number().min(-90).max(500).nullable().optional(),
    minStay: z.number().int().min(1).max(60).nullable().optional(),
    isActive: z.boolean().default(true),
    showOnWebsite: z.boolean().default(false),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "end_before_start" })
  .refine(
    (d) => (d.mode === "percent" ? d.adjustPercent != null : [d.rate2, d.rate3, d.rate4].some((r) => r != null)),
    { message: "missing_rate" }
  );

/* ───────────────────────── extras ───────────────────────── */

export const EXTRA_UNITS = ["stay", "night", "person", "unit"] as const;

export const ExtraInput = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  descriptionEn: z.string().trim().max(1000).nullable().optional(),
  descriptionFr: z.string().trim().max(1000).nullable().optional(),
  price: z.number().min(0).default(0),
  unit: z.enum(EXTRA_UNITS).default("stay"),
  isActive: z.boolean().default(true),
  guestBookable: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
  /** supplied by a rental company: priced in its currency, paid to it */
  partnerId: z.number().int().positive().nullable().optional(),
  categoryEn: z.string().trim().max(80).nullable().optional(),
  categoryFr: z.string().trim().max(80).nullable().optional(),
  imageUrl: z.string().trim().url().max(1000).nullable().optional().or(z.literal("").transform(() => null)),
});

export const ReservationExtraInput = z.object({
  extraId: z.number().int().positive().nullable().optional(),
  label: z.string().trim().min(1).max(200),
  quantity: z.number().min(0).max(1000).default(1),
  unitPrice: z.number().min(0).default(0),
  status: z.enum(["requested", "confirmed", "cancelled"]).default("confirmed"),
  serviceDate: z.string().regex(ISO_DATE).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Editing a line already on a stay — no defaults, so a status change keeps the amounts. */
export const ReservationExtraPatch = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().min(0).max(1000).optional(),
  unitPrice: z.number().min(0).optional(),
  status: z.enum(["requested", "confirmed", "declined", "cancelled"]).optional(),
  serviceDate: z.string().regex(ISO_DATE).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** concierge requests: time, party size and the answer the guest sees */
  serviceTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  guests: z.number().int().min(1).max(100).nullable().optional(),
  adminNote: z.string().trim().max(1000).nullable().optional(),
  /** email the guest the answer (concierge requests, default on) */
  notifyGuest: z.boolean().optional(),
});

/** Arrival details — the same shape from the admin editor and the guest portal. */
export const GuestDetailsInput = z.object({
  arrivalFlight: z.string().trim().max(100).nullable().optional(),
  /** estimated time at the villa — separate from the early check-in time the owner grants */
  arrivalEta: z.string().trim().max(20).nullable().optional(),
  departureFlight: z.string().trim().max(100).nullable().optional(),
  departureEta: z.string().trim().max(20).nullable().optional(),
  adults: z.number().int().min(0).max(20).nullable().optional(),
  children: z.number().int().min(0).max(20).nullable().optional(),
  guestNames: z.string().trim().max(2000).nullable().optional(),
  specialRequests: z.string().trim().max(4000).nullable().optional(),
});

/* ───────────────────────── concierge ───────────────────────── */

const optText = (max: number) =>
  z.string().trim().max(max).nullable().optional().or(z.literal("").transform(() => null));
const optUrl = z.string().trim().url().max(500).nullable().optional().or(z.literal("").transform(() => null));
const optPrice = z.number().min(0).max(1_000_000).nullable().optional();

export const ServicePartnerInput = z.object({
  kind: z.enum(["boat", "chef", "extras"]),
  name: z.string().trim().min(1).max(150),
  contactName: optText(150),
  phone: optText(50),
  whatsapp: optText(50),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  website: optUrl,
  location: optText(255),
  notes: optText(2000),
  currency: z.enum(["USD", "EUR"]).default("EUR"),
  isActive: z.boolean().default(true),
});

export const TaxiInput = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z
    .string()
    .trim()
    .min(4)
    .max(30)
    .transform((s) => s.replace(/[^\d+]/g, "")),
  displayPhone: optText(50),
  zone: optText(100),
  hasWhatsapp: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
});

export const BoatInput = z.object({
  partnerId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  boatType: optText(100),
  capacity: z.number().int().min(1).max(200).default(10),
  length: optText(30),
  descriptionEn: optText(2000),
  descriptionFr: optText(2000),
  includesEn: optText(1000),
  includesFr: optText(1000),
  imageUrl: optUrl,
  priceHalfDay: optPrice,
  priceFullDay: optPrice,
  priceSunset: optPrice,
  priceCruisingDay: optPrice,
  priceTransfer: optPrice,
  transferSbhSxmDay: optPrice,
  transferSbhSxmNight: optPrice,
  transferSxmSbhDay: optPrice,
  transferSxmSbhNight: optPrice,
  transferAnguilla: optPrice,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
});

export const CHEF_CATEGORIES = ["dinner", "brunch", "buffet", "cocktail", "weekly_chef"] as const;

export const ChefOfferInput = z.object({
  partnerId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  category: z.enum(CHEF_CATEGORIES),
  formulaName: optText(150),
  price: optPrice,
  priceType: z.enum(["per_person", "per_day", "quote"]).default("per_person"),
  minimumGuests: z.number().int().min(1).max(500).default(4),
  duration: optText(100),
  descriptionEn: optText(2000),
  descriptionFr: optText(2000),
  menuEn: optText(4000),
  menuFr: optText(4000),
  notes: optText(2000),
  imageUrl: optUrl,
  webPageUrl: optUrl,
  holidaySurcharge: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
});

/* ───────────────────────── guide articles ───────────────────────── */

export const GUIDE_CATEGORIES = ["practical", "island"] as const;

const GuideBi = z.object({ en: z.string().trim(), fr: z.string().trim() });
const GuideSectionInput = z.object({
  h: z.string().trim().min(1),
  p: z.array(z.string().trim().min(1)),
  places: z.array(z.string().trim().min(1)).optional(),
  flightSearch: z.boolean().optional(),
});
const guideDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GuideInput = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(GUIDE_CATEGORIES),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean().default(true),
  publishedOn: guideDate,
  updatedOn: guideDate,
  title: GuideBi.refine((v) => v.en && v.fr),
  description: GuideBi,
  metaTitle: GuideBi,
  metaDescription: GuideBi,
  sections: z.object({ en: z.array(GuideSectionInput), fr: z.array(GuideSectionInput) }),
  links: z.array(z.object({ label: GuideBi, url: z.string().trim().url() })),
});

