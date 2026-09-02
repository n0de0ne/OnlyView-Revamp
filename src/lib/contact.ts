import { getSettings } from "./settings";

/**
 * Who the villa is reached at. The values live in Réglages → Contact
 * (contact_email / contact_phone / contact_whatsapp) so the owner can change
 * them without a deploy; these constants are what the site falls back to when
 * the database is unreachable (an image build, for instance).
 */
export const OWNER_EMAIL = "annaerick971@gmail.com";
export const OWNER_PHONE = "+590 690 39 90 47";
export const OWNER_WHATSAPP = "+590690399047";
/** the villa's pin, shared by the owner */
export const VILLA_MAP_URL = "https://maps.app.goo.gl/9eV7KhFcF9AJdWeLA";

/** wa.me only accepts digits — strip spaces, +, dashes. */
export const whatsappHref = (number: string) =>
  `https://wa.me/${number.replace(/[^0-9]/g, "")}`;

export interface ContactDetails {
  email: string;
  phone: string;
  whatsapp: string;
  /** ready-to-use WhatsApp deep link, or null when no number is configured */
  whatsappUrl: string | null;
  /** the villa's pin on Google Maps */
  mapUrl: string;
}

export async function getContact(): Promise<ContactDetails> {
  let email = OWNER_EMAIL;
  let phone = OWNER_PHONE;
  let whatsapp = OWNER_WHATSAPP;
  let mapUrl = VILLA_MAP_URL;
  try {
    const s = await getSettings();
    email = s.contact_email?.trim() || email;
    phone = s.contact_phone?.trim() || phone;
    whatsapp = s.contact_whatsapp?.trim() ?? whatsapp;
    mapUrl = s.villa_map_url?.trim() || mapUrl;
  } catch {
    // defaults above
  }
  return {
    email,
    phone,
    whatsapp,
    whatsappUrl: whatsapp ? whatsappHref(whatsapp) : null,
    mapUrl,
  };
}

/** Where owner notifications go: ADMIN_NOTIFY_EMAIL wins, then the setting. */
export async function ownerNotifyEmail(): Promise<string> {
  const fromEnv = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return (await getContact()).email;
}
