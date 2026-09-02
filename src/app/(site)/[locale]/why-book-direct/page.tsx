import type { Metadata } from "next";
import Link from "next/link";
import { isLoyaltyEnabled } from "@/lib/features";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, faqJsonLd, jsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const loyalty = await isLoyaltyEnabled();
  return pageMetadata({
    locale,
    path: "/why-book-direct",
    title: t.meta.titleWhyDirect,
    description: loyalty ? t.meta.descWhyDirect : t.meta.descWhyDirectNoLoyalty,
  });
}

export default async function WhyDirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const loyalty = await isLoyaltyEnabled();
  const items = t.whyDirect.items.filter((i) => loyalty || i.tag !== "loyalty");

  const description = loyalty ? t.meta.descWhyDirect : t.meta.descWhyDirectNoLoyalty;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({ locale, path: "/why-book-direct", name: t.whyDirect.title, description }),
            faqJsonLd(
              t.faq.items.filter((i) => /direct|agenc|cost|coûte|réserver|book/i.test(i.q) && (loyalty || i.tag !== "loyalty")).slice(0, 4)
            ),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.whyDirect.title, url: localePath(locale, "/why-book-direct") },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.footer.directBadge}
        title={t.whyDirect.title}
        intro={loyalty ? t.meta.descWhyDirect : t.meta.descWhyDirectNoLoyalty}
      />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item, i) => (
            <div key={i} className="border border-ink/10 bg-white p-8">
              <div className="font-display text-4xl text-gold/40">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-3 font-display text-2xl">{item.t}</h2>
              <p className="mt-3 leading-relaxed text-ink/70">{item.d}</p>
            </div>
          ))}
        </div>
        {/* direct vs agency, side by side — the comparison people search for */}
        <div className="mt-20">
          <h2 className="section-title mb-4 !text-3xl">{t.compare.title}</h2>
          <p className="mb-8 max-w-3xl leading-relaxed text-ink/70">{t.compare.intro}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-[0.68rem] uppercase tracking-[0.2em] text-ink/50">
                  {t.compare.head.map((h, i) => (
                    <th key={i} className={`py-3 pr-4 font-semibold ${i === 1 ? "text-gold" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.compare.rows.map(([label, direct, agency]) => (
                  <tr key={label} className="border-b border-ink/10 align-top">
                    <th scope="row" className="py-4 pr-4 font-semibold text-ink">
                      {label}
                    </th>
                    <td className="py-4 pr-4 text-ink/85">{direct}</td>
                    <td className="py-4 pr-4 text-ink/60">{agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/60">{t.compare.note}</p>
        </div>
        <div className="mt-12 text-center">
          <Link href={localePath(locale, "/booking")} className="btn-gold">
            {t.hero.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
