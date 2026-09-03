import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../globals.css";
import { fontClasses } from "@/lib/fonts";
import { getDict, isLocale, LOCALES, type Locale } from "@/lib/i18n";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MobileTabBar } from "@/components/site/MobileTabBar";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { RevealObserver } from "@/components/motion/RevealObserver";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  // Search Console / Bing Webmaster ownership tokens, pasted in Réglages —
  // ISR picks them up without a deploy
  let verification: Metadata["verification"] = undefined;
  try {
    const s = await getSettings();
    const google = s.google_site_verification?.trim();
    const bing = s.bing_site_verification?.trim();
    if (google || bing) verification = { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) };
  } catch {
    // no database at build time
  }
  return {
    metadataBase: new URL(SITE_URL),
    ...(verification ? { verification } : {}),
    title: {
      default: t.meta.titleHome,
      template: `%s | ${t.meta.siteName}`,
    },
    applicationName: t.meta.siteName,
    formatDetection: { telephone: false },
    openGraph: {
      siteName: t.meta.siteName,
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      images: [{ url: `${SITE_URL}${DEFAULT_OG_IMAGE}`, width: 1200, height: 900, alt: t.meta.siteName }],
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };
}

export default async function SiteLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} className={fontClasses}>
      <body className="has-tabbar">
        <SmoothScroll />
        <RevealObserver />
        <SiteHeader locale={locale as Locale} />
        <main>{children}</main>
        <SiteFooter locale={locale as Locale} />
        <MobileTabBar locale={locale as Locale} />
      </body>
    </html>
  );
}
