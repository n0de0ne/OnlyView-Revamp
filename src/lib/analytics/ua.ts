/**
 * User-agent reading for the analytics: the device/browser/OS of a human
 * visitor, and whether a request comes from a bot — with the crawlers that
 * matter for SEO/GEO named and grouped (search engines, AI assistants…).
 *
 * Shared by the collector (Node) and the middleware, so no Node imports.
 */

export type CrawlerCategory =
  | "ai_search" // fetches pages to answer in an AI search product
  | "ai_user" // fetches a page because a user asked an assistant about it
  | "ai_training" // collects pages to train models
  | "search" // classic search engine index
  | "seo" // SEO tools
  | "social" // link previews (WhatsApp, iMessage, Facebook…)
  | "other";

interface CrawlerDef {
  re: RegExp;
  bot: string;
  operator: string;
  category: CrawlerCategory;
}

/** Order matters: the first match wins (e.g. Googlebot-Image before Googlebot). */
const CRAWLERS: CrawlerDef[] = [
  // AI — OpenAI
  { re: /OAI-SearchBot/i, bot: "OAI-SearchBot", operator: "OpenAI", category: "ai_search" },
  { re: /ChatGPT-User/i, bot: "ChatGPT-User", operator: "OpenAI", category: "ai_user" },
  { re: /GPTBot/i, bot: "GPTBot", operator: "OpenAI", category: "ai_training" },
  // AI — Anthropic
  { re: /Claude-SearchBot/i, bot: "Claude-SearchBot", operator: "Anthropic", category: "ai_search" },
  { re: /Claude-User/i, bot: "Claude-User", operator: "Anthropic", category: "ai_user" },
  { re: /ClaudeBot|anthropic-ai|Claude-Web/i, bot: "ClaudeBot", operator: "Anthropic", category: "ai_training" },
  // AI — Perplexity
  { re: /Perplexity-User/i, bot: "Perplexity-User", operator: "Perplexity", category: "ai_user" },
  { re: /PerplexityBot/i, bot: "PerplexityBot", operator: "Perplexity", category: "ai_search" },
  // AI — others
  { re: /MistralAI-User/i, bot: "MistralAI-User", operator: "Mistral", category: "ai_user" },
  { re: /DuckAssistBot/i, bot: "DuckAssistBot", operator: "DuckDuckGo", category: "ai_search" },
  { re: /YouBot/i, bot: "YouBot", operator: "You.com", category: "ai_search" },
  { re: /PhindBot/i, bot: "PhindBot", operator: "Phind", category: "ai_search" },
  { re: /meta-externalagent|meta-externalfetcher/i, bot: "Meta-ExternalAgent", operator: "Meta", category: "ai_training" },
  { re: /Applebot-Extended/i, bot: "Applebot-Extended", operator: "Apple", category: "ai_training" },
  { re: /Bytespider/i, bot: "Bytespider", operator: "ByteDance", category: "ai_training" },
  { re: /CCBot/i, bot: "CCBot", operator: "Common Crawl", category: "ai_training" },
  { re: /Amazonbot/i, bot: "Amazonbot", operator: "Amazon", category: "ai_search" },
  { re: /cohere-ai|cohere-training/i, bot: "cohere-ai", operator: "Cohere", category: "ai_training" },
  { re: /Google-CloudVertexBot/i, bot: "Google-CloudVertexBot", operator: "Google", category: "ai_training" },
  { re: /Diffbot/i, bot: "Diffbot", operator: "Diffbot", category: "ai_training" },
  { re: /Timpibot/i, bot: "Timpibot", operator: "Timpi", category: "ai_training" },
  { re: /AI2Bot/i, bot: "AI2Bot", operator: "Allen Institute", category: "ai_training" },
  // Search engines
  { re: /Googlebot-Image/i, bot: "Googlebot-Image", operator: "Google", category: "search" },
  { re: /Google-InspectionTool/i, bot: "Google-InspectionTool", operator: "Google", category: "search" },
  { re: /GoogleOther/i, bot: "GoogleOther", operator: "Google", category: "search" },
  { re: /Googlebot|AdsBot-Google|Mediapartners-Google|Storebot-Google/i, bot: "Googlebot", operator: "Google", category: "search" },
  { re: /bingbot|BingPreview|msnbot|adidxbot/i, bot: "Bingbot", operator: "Microsoft", category: "search" },
  { re: /Applebot/i, bot: "Applebot", operator: "Apple", category: "search" },
  { re: /DuckDuckBot/i, bot: "DuckDuckBot", operator: "DuckDuckGo", category: "search" },
  { re: /YandexBot|YandexImages/i, bot: "YandexBot", operator: "Yandex", category: "search" },
  { re: /Baiduspider/i, bot: "Baiduspider", operator: "Baidu", category: "search" },
  { re: /Qwantbot|Qwantify/i, bot: "Qwantbot", operator: "Qwant", category: "search" },
  { re: /Yahoo! Slurp/i, bot: "Yahoo Slurp", operator: "Yahoo", category: "search" },
  { re: /Ecosia/i, bot: "EcosiaBot", operator: "Ecosia", category: "search" },
  { re: /SeznamBot/i, bot: "SeznamBot", operator: "Seznam", category: "search" },
  { re: /PetalBot/i, bot: "PetalBot", operator: "Huawei", category: "search" },
  // SEO tools
  { re: /AhrefsBot|AhrefsSiteAudit/i, bot: "AhrefsBot", operator: "Ahrefs", category: "seo" },
  { re: /SemrushBot|SiteAuditBot/i, bot: "SemrushBot", operator: "Semrush", category: "seo" },
  { re: /MJ12bot/i, bot: "MJ12bot", operator: "Majestic", category: "seo" },
  { re: /DotBot|rogerbot/i, bot: "Moz", operator: "Moz", category: "seo" },
  { re: /Screaming Frog/i, bot: "Screaming Frog", operator: "Screaming Frog", category: "seo" },
  { re: /DataForSeoBot/i, bot: "DataForSeoBot", operator: "DataForSEO", category: "seo" },
  // Link previews
  { re: /facebookexternalhit|facebookcatalog|FacebookBot/i, bot: "Facebook preview", operator: "Meta", category: "social" },
  { re: /WhatsApp/i, bot: "WhatsApp preview", operator: "Meta", category: "social" },
  { re: /Twitterbot/i, bot: "Twitterbot", operator: "X", category: "social" },
  { re: /LinkedInBot/i, bot: "LinkedInBot", operator: "LinkedIn", category: "social" },
  { re: /Pinterestbot|Pinterest\//i, bot: "Pinterestbot", operator: "Pinterest", category: "social" },
  { re: /Slackbot/i, bot: "Slackbot", operator: "Slack", category: "social" },
  { re: /TelegramBot/i, bot: "TelegramBot", operator: "Telegram", category: "social" },
  { re: /Discordbot/i, bot: "Discordbot", operator: "Discord", category: "social" },
  { re: /redditbot/i, bot: "redditbot", operator: "Reddit", category: "social" },
  { re: /Snapchat/i, bot: "Snapchat preview", operator: "Snap", category: "social" },
];

/** Generic automation that isn't a named crawler — not a human either. */
const GENERIC_BOT =
  /bot\b|bot\/|crawl|spider|slurp|scrape|fetch|monitor|uptime|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|python-requests|python-urllib|aiohttp|httpx|curl\/|wget|go-http-client|okhttp|java\/|libwww|axios|node-fetch|undici|postman|insomnia|scrapy|httpclient|feed|preview|validator|checker/i;

export interface CrawlerMatch {
  bot: string;
  operator: string;
  category: CrawlerCategory;
}

export function matchCrawler(ua: string | null | undefined): CrawlerMatch | null {
  if (!ua) return null;
  for (const c of CRAWLERS) {
    if (c.re.test(ua)) return { bot: c.bot, operator: c.operator, category: c.category };
  }
  return null;
}

export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return Boolean(matchCrawler(ua)) || GENERIC_BOT.test(ua);
}

export interface UAInfo {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
}

export function parseUA(ua: string, touch?: boolean): UAInfo {
  let os = "Autre";
  if (/iPhone|iPod/.test(ua)) os = "iOS";
  else if (/iPad/.test(ua)) os = "iPadOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "Autre";
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/FBAN|FBAV|FB_IAB/.test(ua)) browser = "Facebook (in-app)";
  else if (/Instagram/.test(ua)) browser = "Instagram (in-app)";
  else if (/GSA\//.test(ua)) browser = "Google app";
  else if (/Firefox|FxiOS/.test(ua)) browser = "Firefox";
  else if (/Chrome|CriOS|Chromium/.test(ua)) browser = "Chrome";
  else if (/Safari/.test(ua)) browser = "Safari";

  let device: UAInfo["device"] = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua)) device = "mobile";
  // iPadOS 13+ reports itself as a Mac; the tracker flags touch screens
  else if (touch && os === "macOS") {
    device = "tablet";
    os = "iPadOS";
  }
  return { device, browser, os };
}
