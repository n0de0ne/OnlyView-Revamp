import type { Metadata } from "next";
import Link from "next/link";
import { isLoyaltyEnabled } from "@/lib/features";
import { isLocale, localePath, tpl, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, jsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import { getRateConfig } from "@/lib/settings";
import { publicRateTable } from "@/lib/pricing";
import { usd } from "@/lib/money";
import { formatDateShort, addDays, todayISO } from "@/lib/dates";
import { EditorialHero, SectionHead } from "@/components/site/ov/EditorialHero";
import { prisma } from "@/lib/db";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  return pageMetadata({
    locale,
    path: "/rates",
    title: t.meta.titleRates,
    description: t.meta.descRates,
  });
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
  const t = await getContent(locale);
  const fr = locale === "fr";
  const [rates, promos, loyalty] = await Promise.all([
    getRateConfig(),
    getWebsitePromotions(),
    isLoyaltyEnabled(),
  ]);
  const table = publicRateTable(rates, todayISO());

  const offers = {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    "@id": `${SITE_URL}/#offers`,
    url: `${SITE_URL}${fr ? "/fr" : ""}/rates`,
    itemOffered: { "@id": `${SITE_URL}/#villa` },
    availability: "https://schema.org/InStock",
    validFrom: new Date().toISOString().slice(0, 10),
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
      <EditorialHero eyebrow={t.nav.rates} title={t.rates.title} intro={loyalty ? t.rates.intro : t.rates.introNoLoyalty} />

      <section className="ov-shell pb-20 md:pb-28">
        {/* Season rates — ruled blocks on a phone (a five-column table can't be
            read at 390px), a ledger from small screens up */}
        <div className="ov-rule border-t sm:hidden">
          {table.seasons.map((s) => (
            <div key={s.key} className="ov-rule border-b py-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[1.75rem] leading-none">{t.rates.seasonNames[s.key]}</h3>
                <span className="ov-label text-right !text-[0.62rem] text-ink/55">{fr ? s.datesFr : s.datesEn}</span>
              </div>
              <dl className="mt-4 space-y-1.5">
                {([2, 3, 4] as const).map((b) => (
                  <div key={b} className="flex items-baseline justify-between">
                    <dt className="text-sm text-ink/65">{t.rates[`br${b}` as "br2" | "br3" | "br4"]}</dt>
                    <dd className="text-right">
                      <span className="font-display text-xl [font-variant-numeric:lining-nums]">{usd(s.weekly[b])}</span>
                      <span className="ml-1.5 text-xs text-ink/45">{t.rates.weekly}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="ov-rule border-b">
                <th className="ov-label py-4 pr-6 font-medium text-ink/50">{t.rates.season}</th>
                <th className="ov-label py-4 pr-6 font-medium text-ink/50">{t.rates.dates}</th>
                <th className="ov-label py-4 pl-6 text-right font-medium text-ink/50">{t.rates.br2}</th>
                <th className="ov-label py-4 pl-6 text-right font-medium text-ink/50">{t.rates.br3}</th>
                <th className="ov-label py-4 pl-6 text-right font-medium text-ink/50">{t.rates.br4}</th>
              </tr>
            </thead>
            <tbody>
              {table.seasons.map((s) => (
                <tr key={s.key} className="ov-rule border-b">
                  <td className="py-7 pr-6 font-display text-[clamp(1.6rem,2.4vw,2.2rem)] leading-none">
                    {t.rates.seasonNames[s.key]}
                  </td>
                  <td className="py-7 pr-6 text-sm text-ink/60">{fr ? s.datesFr : s.datesEn}</td>
                  {[2, 3, 4].map((b) => (
                    <td key={b} className="py-7 pl-6 text-right">
                      <span className="font-display text-[clamp(1.4rem,2vw,1.85rem)] leading-none [font-variant-numeric:lining-nums]">
                        {usd(s.weekly[b as 2 | 3 | 4])}
                      </span>
                      <span className="ov-label mt-1.5 block !text-[0.6rem] text-ink/40">{t.rates.weekly}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Festive weeks, on the deep-sea panel */}
      <section className="bg-sea py-20 text-white md:py-28">
        <div className="ov-shell">
          <SectionHead title={t.rates.holidayTitle} light aside={<p className="max-w-sm text-sm leading-relaxed text-white/65">{t.rates.holidayNote}</p>} />
          <div className="grid border-t border-white/15 md:grid-cols-2">
            {table.holidays.map((h, i) => (
              <div
                key={h.key}
                className={`flex flex-col justify-between gap-10 border-b border-white/15 py-8 md:min-h-[16rem] ${i === 0 ? "md:border-r md:pr-10" : "md:pl-10"}`}
              >
                <div>
                  <p className="ov-label text-gold">{fr ? h.datesFr : h.datesEn}</p>
                  <h3 className="ov-h3 mt-3">{t.rates.seasonNames[h.key]}</h3>
                </div>
                <p className="flex items-baseline gap-3">
                  <span className="font-display text-[clamp(2.6rem,5vw,4.2rem)] leading-none text-white [font-variant-numeric:lining-nums]">
                    {usd(h.weekly)}
                  </span>
                  <span className="ov-label text-white/50">{t.rates.weekly}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ov-shell py-20 md:py-28">
        {/* Dated periods the owner published (regatta weeks…) */}
        {table.specials.length > 0 && (
          <div className="mb-16">
            <SectionHead title={t.rates.specialTitle} className="!mb-8" />
            <div className="ov-rule border-t">
              {table.specials.map((sp) => (
                <div key={sp.id} className="ov-rule flex flex-wrap items-center justify-between gap-3 border-b py-6">
                  <div>
                    <div className="font-display text-2xl">{sp.name}</div>
                    <div className="ov-label mt-2 text-ink/50">
                      {formatDateShort(sp.start, locale)} → {formatDateShort(addDays(sp.end, 1), locale)}
                      {sp.minStay ? ` · ${tpl(t.rates.specialMinStay, { n: sp.minStay })}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    {sp.mode === "percent" ? (
                      <div className="font-display text-2xl text-gold-dark [font-variant-numeric:lining-nums]">
                        {tpl(t.rates.specialPercent, {
                          pct: `${sp.adjustPercent >= 0 ? "+" : ""}${sp.adjustPercent}%`,
                        })}
                      </div>
                    ) : (
                      <>
                        <div className="font-display text-2xl text-gold-dark [font-variant-numeric:lining-nums]">
                          {([2, 3, 4] as const)
                            .filter((b) => sp.weekly[b] != null)
                            .map((b) => `${b} ${t.common.bedrooms} ${usd(sp.weekly[b]!)}`)
                            .join(" · ")}
                        </div>
                        <div className="ov-label mt-1 text-ink/45">{t.rates.specialFixed}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active promotions */}
        {promos.length > 0 && (
          <div className="mb-16 grid gap-3 md:grid-cols-2">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl bg-ivory px-6 py-5">
                <div>
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="mt-0.5 text-sm text-ink/60">{p.description}</div>}
                </div>
                <div className="shrink-0 font-display text-3xl leading-none text-gold-dark [font-variant-numeric:lining-nums]">
                  {p.discountType === "percent"
                    ? `-${p.discountValue}%`
                    : p.discountType === "fixed"
                      ? `-${usd(p.discountValue)}`
                      : `${p.discountValue} ${t.common.nights}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Terms, then the one action */}
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <ol className="ov-rule border-t lg:col-span-7">
            {[tpl(t.rates.minStay, { n: rates.minStay, p: rates.minStayPeak }), t.rates.tax, t.rates.deposit].map((line, i) => (
              <li key={i} className="ov-rule flex gap-5 border-b py-4 text-[0.95rem] text-ink/70">
                <span className="ov-label pt-1 text-gold-dark">{String(i + 1).padStart(2, "0")}</span>
                {line}
              </li>
            ))}
          </ol>
          <div className="lg:col-span-4 lg:col-start-9 lg:justify-self-end">
            <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
              {t.rates.quote}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
