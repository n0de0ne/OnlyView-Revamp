import type { Metadata } from "next";
import Link from "next/link";
import { isLoyaltyEnabled } from "@/lib/features";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, faqJsonLd, jsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { EditorialHero, SectionHead } from "@/components/site/ov/EditorialHero";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
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
  const t = await getContent(locale);
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
      <EditorialHero
        eyebrow={t.footer.directBadge}
        title={t.whyDirect.title}
        intro={loyalty ? t.meta.descWhyDirect : t.meta.descWhyDirectNoLoyalty}
      />
      <section className="ov-shell pb-20 md:pb-28">
        <div className="ov-rule grid border-t sm:grid-cols-2">
          {items.map((item, i) => (
            <div
              key={i}
              className={`ov-rule reveal flex flex-col gap-5 border-b py-8 md:py-10 ${i % 2 === 0 ? "sm:border-r sm:pr-10" : "sm:pl-10"}`}
            >
              <span className="ov-label text-gold-dark">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="ov-h3 text-ink">{item.t}</h2>
              <p className="ov-body max-w-md">{item.d}</p>
            </div>
          ))}
        </div>
        {/* direct vs agency, side by side — the comparison people search for */}
        <div className="mt-24 md:mt-32">
          <SectionHead title={t.compare.title} aside={<p className="ov-body max-w-md">{t.compare.intro}</p>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="ov-rule border-b font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink/50">
                  {t.compare.head.map((h, i) => (
                    <th key={i} className={`py-4 pr-6 font-medium ${i === 1 ? "text-gold-dark" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.compare.rows.map(([label, direct, agency]) => (
                  <tr key={label} className="ov-rule border-b align-top">
                    <th scope="row" className="py-5 pr-6 font-display text-lg font-medium text-ink">
                      {label}
                    </th>
                    <td className="py-5 pr-6 text-ink/85">{direct}</td>
                    <td className="py-5 pr-6 text-ink/55">{agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/60">{t.compare.note}</p>
        </div>
        <div className="mt-14">
          <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
            {t.hero.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
