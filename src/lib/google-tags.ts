import { getSettings } from "./settings";

/**
 * Google Analytics 4 / Google Ads tags, set in Réglages. Unlike the site's
 * own measurement these are third-party cookies, so the public site loads
 * them only after the visitor accepts the consent banner.
 */

export const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
export const ADS_ID = /^AW-\d{6,15}$/;
/** conversion labels are short base64-ish strings (e.g. "AbC-D_efGhIjK") */
export const ADS_LABEL = /^[A-Za-z0-9_-]{4,40}$/;

/** first-party events that count as Google Ads conversions, with their Réglages key */
export const ADS_CONVERSIONS = {
  booking_request: "google_ads_label_booking",
  contract_signed: "google_ads_label_contract",
  contact_submit: "google_ads_label_contact",
} as const;

export interface GoogleTagsConfig {
  ga: string | null;
  ads: string | null;
  /** event name → Google Ads conversion label */
  labels: Partial<Record<keyof typeof ADS_CONVERSIONS, string>>;
}

export async function googleTagsConfig(): Promise<GoogleTagsConfig> {
  const s = await getSettings();
  const ga = s.google_analytics_id?.trim().toUpperCase() ?? "";
  const ads = s.google_ads_id?.trim().toUpperCase() ?? "";
  const labels: GoogleTagsConfig["labels"] = {};
  for (const [event, key] of Object.entries(ADS_CONVERSIONS) as Array<[keyof typeof ADS_CONVERSIONS, string]>) {
    const label = s[key]?.trim() ?? "";
    if (ADS_LABEL.test(label)) labels[event] = label;
  }
  return {
    ga: GA4_ID.test(ga) ? ga : null,
    ads: ADS_ID.test(ads) ? ads : null,
    labels: ADS_ID.test(ads) ? labels : {},
  };
}
