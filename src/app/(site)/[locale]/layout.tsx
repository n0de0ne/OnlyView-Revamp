import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../globals.css";
import { fontClasses } from "@/lib/fonts";
import { getDict, isLocale, LOCALES, type Locale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

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
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t.meta.titleHome,
      template: `%s | ${t.meta.siteName} St Barth`,
    },
    applicationName: t.meta.siteName,
    formatDetection: { telephone: false },
    openGraph: {
      siteName: t.meta.siteName,
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    robots: { index: true, follow: true },
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
      <body>
        <SiteHeader locale={locale as Locale} />
        <main>{children}</main>
        <SiteFooter locale={locale as Locale} />
      </body>
    </html>
  );
}
