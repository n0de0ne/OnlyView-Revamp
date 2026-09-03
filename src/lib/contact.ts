import { getSettings } from "./settings";
import { OWNER_EMAIL, OWNER_PHONE, OWNER_WHATSAPP, VILLA_MAP_URL } from "./site-facts";

export { OWNER_EMAIL, OWNER_PHONE, OWNER_WHATSAPP, VILLA_MAP_URL };

/**
 * Who the villa is reached at. The values live in Réglages → Contact
 * (contact_email / contact_phone / contact_whatsapp) so the owner can change
 * them without a deploy; these constants are what the site falls back to when
 * the database is unreachable (an image build, for instance).
 */
/** wa.me only accepts digits — strip spaces, +, dashes. */
export const whatsappHref = (number: string) =>
  `https://wa.me/${number.replace(/[^0-9]/g, "")}`;

/** Réglages → Contact: one URL each, empty = not listed. `listing_urls`
    (several, separated by spaces or commas) are the villa's pages on the
    agencies' sites — they join `sameAs` too. */
export const SOCIAL_KEYS = [
  "social_instagram",
  "social_facebook",
  "social_tripadvisor",
  "social_google",
  "social_youtube",
] as const;

export interface ContactDetails {
  email: string;
  phone: string;
  whatsapp: string;
  /** ready-to-use WhatsApp deep link, or null when no number is configured */
  whatsappUrl: string | null;
  /** the villa's pin on Google Maps */
  mapUrl: string;
  /** public profiles of the villa (Instagram, Facebook, TripAdvisor…) — the
      `sameAs` of its structured data, so engines merge them into one entity */
  sameAs: string[];
}

export async function getContact(): Promise<ContactDetails> {
  let email = OWNER_EMAIL;
  let phone = OWNER_PHONE;
  let whatsapp = OWNER_WHATSAPP;
  let mapUrl = VILLA_MAP_URL;
  const sameAs: string[] = [];
  try {
    const s = await getSettings();
    email = s.contact_email?.trim() || email;
    phone = s.contact_phone?.trim() || phone;
    whatsapp = s.contact_whatsapp?.trim() ?? whatsapp;
    mapUrl = s.villa_map_url?.trim() || mapUrl;
    for (const key of SOCIAL_KEYS) {
      const v = s[key]?.trim();
      if (v && /^https?:\/\//.test(v)) sameAs.push(v);
    }
    // the villa's pages on the agencies' and platforms' sites (WIMCO,
    // Airbnb, Eden Rock Villa Rental…): the same house, so the same entity
    for (const v of (s.listing_urls ?? "").split(/[\s,]+/)) {
      if (/^https?:\/\//.test(v) && !sameAs.includes(v)) sameAs.push(v);
    }
  } catch {
    // defaults above
  }
  return {
    email,
    phone,
    whatsapp,
    whatsappUrl: whatsapp ? whatsappHref(whatsapp) : null,
    mapUrl,
    sameAs,
  };
}

/** Where owner notifications go: ADMIN_NOTIFY_EMAIL wins, then the setting. */
export async function ownerNotifyEmail(): Promise<string> {
  const fromEnv = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return (await getContact()).email;
}
