/**
 * Where a visit came from: the referrer and campaign tags sorted into a
 * channel (search, AI assistant, agency, social…) and a named source.
 */

export type Channel =
  | "search"
  | "ai"
  | "agency"
  | "social"
  | "email"
  | "paid"
  | "referral"
  | "direct";

export const CHANNEL_LABELS: Record<Channel, string> = {
  search: "Moteurs de recherche",
  ai: "Assistants IA",
  agency: "Agences & annonces",
  social: "Réseaux sociaux",
  email: "Email",
  paid: "Publicité",
  referral: "Autres sites",
  direct: "Direct",
};

type Rule = [RegExp, string];

// matched against the referrer host (www. stripped)
const AI: Rule[] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/^gemini\.google\.com$|^bard\.google\.com$|^aistudio\.google\.com$/, "Gemini"],
  [/^copilot\.microsoft\.com$|^copilot\.cloud\.microsoft$|^edgeservices\.bing\.com$/, "Copilot"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)meta\.ai$/, "Meta AI"],
  [/(^|\.)grok\.com$|^x\.ai$/, "Grok"],
  [/(^|\.)deepseek\.com$/, "DeepSeek"],
  [/^chat\.mistral\.ai$/, "Le Chat (Mistral)"],
  [/(^|\.)poe\.com$/, "Poe"],
  [/(^|\.)you\.com$/, "You.com"],
  [/(^|\.)phind\.com$/, "Phind"],
  [/(^|\.)kagi\.com$/, "Kagi"],
];

const SEARCH: Rule[] = [
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.[a-z.]+$/, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)qwant\.com$/, "Qwant"],
  [/^search\.brave\.com$/, "Brave Search"],
  [/(^|\.)startpage\.com$/, "Startpage"],
  [/(^|\.)yandex\.[a-z.]+$/, "Yandex"],
  [/(^|\.)baidu\.com$/, "Baidu"],
  [/(^|\.)naver\.com$/, "Naver"],
  [/(^|\.)aol\.com$/, "AOL"],
  [/(^|\.)lilo\.org$/, "Lilo"],
];

const SOCIAL: Rule[] = [
  [/(^|\.)facebook\.com$|^fb\.me$|(^|\.)messenger\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/^t\.co$|(^|\.)twitter\.com$|^x\.com$/, "X / Twitter"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/, "Pinterest"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)threads\.net$|(^|\.)threads\.com$/, "Threads"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "WhatsApp"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "Tripadvisor"],
];

/** Villa agencies and listing sites — the ones that list Only View first. */
const AGENCY: Rule[] = [
  [/(^|\.)wimco\.com$/, "WIMCO"],
  [/(^|\.)islebluestbarth\.com$|(^|\.)isleblue\.co$|(^|\.)isle-blue\.com$/, "Isle Blue"],
  [/(^|\.)villaway\.com$/, "Villaway"],
  [/(^|\.)stbarth\.com$/, "stbarth.com"],
  [/(^|\.)premierproperties-stbarth\.com$|(^|\.)premier-properties\.com$/, "Premier Properties"],
  [/(^|\.)sibarth\.com$/, "Sibarth"],
  [/(^|\.)stbarthproperties\.com$/, "St Barth Properties"],
  [/(^|\.)lecollectionist\.com$/, "Le Collectionist"],
  [/(^|\.)villanovo\.[a-z.]+$/, "Villanovo"],
  [/(^|\.)stbarth-villas\.com$/, "St Barth Villas"],
  [/(^|\.)eden-villas\.com$/, "Eden Villas"],
  [/(^|\.)airbnb\.[a-z.]+$/, "Airbnb"],
  [/(^|\.)vrbo\.com$|(^|\.)abritel\.fr$|(^|\.)homeaway\.[a-z.]+$/, "Vrbo"],
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)onefinestay\.com$/, "onefinestay"],
  [/(^|\.)luxuryretreats\.com$|(^|\.)homesandvillasbymarriott\.com$/, "Marriott Homes & Villas"],
  [/(^|\.)villasofdistinction\.com$/, "Villas of Distinction"],
];

const WEBMAIL = /^mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|(^|\.)mail\.yahoo\.com$|(^|\.)webmail\.|(^|\.)mail\.proton\.me$|(^|\.)icloud\.com$/;

/** utm_source values written by the AI products themselves */
const AI_UTM: Rule[] = [
  [/^chatgpt(\.com)?$|^openai$/, "ChatGPT"],
  [/^perplexity(\.ai)?$/, "Perplexity"],
  [/^copilot(\.com)?$|^bing\.com\/chat$/, "Copilot"],
  [/^gemini$/, "Gemini"],
  [/^claude(\.ai)?$/, "Claude"],
];

const match = (rules: Rule[], host: string) => rules.find(([re]) => re.test(host))?.[1] ?? null;

/** Android apps send `android-app://<package>/` as the referrer */
const ANDROID_APPS: Record<string, string> = {
  "com.google.android.googlequicksearchbox": "google.com",
  "com.google.android.gm": "mail.google.com",
  "com.instagram.android": "instagram.com",
  "com.facebook.katana": "facebook.com",
  "com.facebook.orca": "messenger.com",
  "com.linkedin.android": "linkedin.com",
  "com.pinterest": "pinterest.com",
  "com.twitter.android": "x.com",
  "com.whatsapp": "whatsapp.com",
  "com.openai.chatgpt": "chatgpt.com",
  "ai.perplexity.app.android": "perplexity.ai",
};

export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return ANDROID_APPS[host] ?? host;
  } catch {
    return null;
  }
}

/** utm_source spellings people use for the same network */
const UTM_ALIASES: Rule[] = [
  [/^(ig|insta|instagram)(\.com)?$/, "instagram.com"],
  [/^(fb|facebook|meta)(\.com)?$/, "facebook.com"],
  [/^(tw|twitter|x)(\.com)?$/, "x.com"],
  [/^(li|linkedin)(\.com)?$/, "linkedin.com"],
  [/^(yt|youtube)(\.com)?$/, "youtube.com"],
  [/^(pin|pinterest)(\.com)?$/, "pinterest.com"],
  [/^(wa|whatsapp)(\.com)?$/, "whatsapp.com"],
  [/^tiktok(\.com)?$/, "tiktok.com"],
];

export interface Attribution {
  channel: Channel;
  source: string | null;
}

export function classify(opts: {
  referrerHost: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  clickIdType?: string | null;
}): Attribution {
  const host = opts.referrerHost;
  const utmSource = opts.utmSource?.toLowerCase().trim() || null;
  const utmMedium = opts.utmMedium?.toLowerCase().trim() || null;

  if (utmSource) {
    const ai = match(AI_UTM, utmSource);
    if (ai) return { channel: "ai", source: ai };
  }
  if (host) {
    const ai = match(AI, host);
    if (ai) return { channel: "ai", source: ai };
  }
  const paidClick = Boolean(opts.clickIdType && /^(gclid|gbraid|wbraid|msclkid|dclid)$/.test(opts.clickIdType));
  if (paidClick || (utmMedium && /^(cpc|ppc|paid|paidsearch|paid_social|display|cpm|ads?)$/.test(utmMedium))) {
    return { channel: "paid", source: utmSource ?? (host ? match(SEARCH, host) ?? match(SOCIAL, host) ?? host : null) };
  }
  if (utmMedium && /e-?mail|newsletter/.test(utmMedium)) return { channel: "email", source: utmSource };
  // in-app browsers reported by name ("facebook (in-app)")
  const inApp = host && /^(facebook|instagram)\b/.test(host) && !host.includes(".") ? `${host.split(/\W/)[0]}.com` : null;
  if (host && inApp) return { channel: "social", source: match(SOCIAL, inApp) };
  if (host) {
    if (WEBMAIL.test(host)) return { channel: "email", source: host };
    const search = match(SEARCH, host);
    if (search) return { channel: "search", source: search };
    const agency = match(AGENCY, host);
    if (agency) return { channel: "agency", source: agency };
    const social = match(SOCIAL, host);
    if (social) return { channel: "social", source: social };
    return { channel: "referral", source: host };
  }
  if (utmSource) {
    const alias = match(UTM_ALIASES, utmSource);
    const social = match(SOCIAL, alias ?? utmSource) ?? match(SOCIAL, `${utmSource}.com`);
    if (social) return { channel: "social", source: social };
    if (utmMedium === "social") return { channel: "social", source: utmSource };
    return { channel: "referral", source: utmSource };
  }
  return { channel: "direct", source: null };
}
