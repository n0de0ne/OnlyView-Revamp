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
