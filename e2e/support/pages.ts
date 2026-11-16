import type { Page } from "@playwright/test";

/** The public pages, as paths without the language prefix ("" is the home page). */
export const PUBLIC_PAGES = [
  "",
  "/villa",
  "/tour",
  "/gallery",
  "/rates",
  "/booking",
  "/contact",
  "/faq",
  "/reviews",
  "/guide",
  "/map",
  "/pointe-milou",
  "/why-book-direct",
  "/account",
  "/legal",
  "/privacy",
] as const;

/** English lives at the root, French under /fr. */
export const localized = (path: string, locale: "en" | "fr") => (locale === "fr" ? `/fr${path}` : path || "/");

/** Width of what sticks out of the viewport sideways (0 when the page fits). */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** A phone, for the specs that check the small-screen layout. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
} as const;
