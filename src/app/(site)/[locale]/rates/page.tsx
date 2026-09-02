import type { Metadata } from "next";
import Link from "next/link";
import { isLoyaltyEnabled } from "@/lib/features";
import { getDict, isLocale, localePath, tpl, type Locale } from "@/lib/i18n";
import { altLanguages, breadcrumbJsonLd, jsonLd, SITE_URL } from "@/lib/seo";
import { getRateConfig } from "@/lib/settings";
import { publicRateTable } from "@/lib/pricing";
import { usd } from "@/lib/money";
import { PageHero } from "@/components/site/PageHero";
import { prisma } from "@/lib/db";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    title: t.meta.titleRates,
    description: t.meta.descRates,
    alternates: altLanguages("/rates"),
  };
}

async function getWebsitePromotions() {
  try {
    return await prisma.promotion.findMany({
      where: { isActive: true, showOnWebsite: true },
      orderBy: { priority: "desc" },
      take: 3,
    });
  } catch {
    return [];
  }
}

export default async function RatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";
  const [rates, promos, loyalty] = await Promise.all([
    getRateConfig(),
    getWebsitePromotions(),
    isLoyaltyEnabled(),
  ]);
  const table = publicRateTable(rates);

  const offers = {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    url: `${SITE_URL}${fr ? "/fr" : ""}/rates`,
    priceCurrency: "USD",
    lowPrice: Math.round(rates.lowSeason[2] / 7),
    highPrice: Math.round(rates.newYearWeekly / 7),
    unitText: "per night",
    offerCount: 5,
    seller: { "@type": "Organization", name: "Villa ONLY VIEW", url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            offers,
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.nav.rates, url: localePath(locale, "/rates") },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={t.nav.rates} title={t.rates.title} intro={loyalty ? t.rates.intro : t.rates.introNoLoyalty} />

      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        {/* Season table */}
        <div className="overflow-x-auto border border-ink/10 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-sand-dark text-[0.68rem] uppercase tracking-[0.2em] text-ink/60">
                <th className="px-6 py-4 font-semibold">{t.rates.season}</th>
                <th className="px-6 py-4 font-semibold">{t.rates.dates}</th>
                <th className="px-6 py-4 text-right font-semibold">{t.rates.br2}</th>
                <th className="px-6 py-4 text-right font-semibold">{t.rates.br3}</th>
                <th className="px-6 py-4 text-right font-semibold">{t.rates.br4}</th>
              </tr>
            </thead>
            <tbody>
              {table.seasons.map((s) => (
                <tr key={s.key} className="border-b border-ink/5 last:border-0">
                  <td className="px-6 py-5 font-display text-lg">
                    {t.rates.seasonNames[s.key]}
                  </td>
                  <td className="px-6 py-5 text-ink/60">{fr ? s.datesFr : s.datesEn}</td>
                  {[2, 3, 4].map((b) => (
                    <td key={b} className="px-6 py-5 text-right">
                      <span className="font-semibold">{usd(s.weekly[b as 2 | 3 | 4])}</span>
                      <span className="block text-[0.65rem] text-ink/45">{t.rates.weekly}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Holiday packages */}
        <h2 className="section-title mt-16 mb-6 !text-3xl">{t.rates.holidayTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {table.holidays.map((h) => (
            <div
              key={h.key}
              className="flex items-center justify-between border border-gold/40 bg-gradient-to-br from-white to-sand-dark px-7 py-6"
            >
              <div>
                <div className="font-display text-2xl">{t.rates.seasonNames[h.key]}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/50">
                  {fr ? h.datesFr : h.datesEn}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl text-gold">{usd(h.weekly)}</div>
                <div className="text-[0.65rem] uppercase tracking-widest text-ink/45">
                  {t.rates.weekly}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink/60">{t.rates.holidayNote}</p>

        {/* Active promotions */}
        {promos.length > 0 && (
          <div className="mt-12 space-y-3">
            {promos.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-gold bg-white px-6 py-4"
              >
                <div>
                  <div className="font-semibold">{p.name}</div>
                  {p.description && (
                    <div className="text-sm text-ink/60">{p.description}</div>
                  )}
                </div>
                <div className="font-display text-2xl text-gold">
                  {p.discountType === "percent"
                    ? `-${p.discountValue}%`
                    : p.discountType === "fixed"
                      ? `-${usd(p.discountValue)}`
                      : `${p.discountValue} ${t.common.nights} ✦`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Terms */}
        <ul className="mt-12 space-y-2.5 border-t border-ink/10 pt-8 text-sm text-ink/65">
          <li>• {tpl(t.rates.minStay, { n: rates.minStay, p: rates.minStayPeak })}</li>
          <li>• {t.rates.tax}</li>
          <li>• {t.rates.deposit}</li>
        </ul>

        <div className="mt-10 text-center">
          <Link href={localePath(locale, "/booking")} className="btn-gold">
            {t.rates.quote}
          </Link>
        </div>
      </section>
    </>
  );
}
