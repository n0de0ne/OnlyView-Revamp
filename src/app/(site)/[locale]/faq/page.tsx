import type { Metadata } from "next";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { altLanguages, faqJsonLd, jsonLd } from "@/lib/seo";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    title: t.meta.titleFaq,
    description: t.meta.descFaq,
    alternates: altLanguages("/faq"),
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd(t.faq.items)) }}
      />
      <PageHero eyebrow="FAQ" title={t.faq.title} />
      <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
        <div className="divide-y divide-ink/10">
          {t.faq.items.map((item, i) => (
            <details key={i} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-ink transition hover:text-gold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink/70">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 border-t border-ink/10 pt-10 text-center">
          <p className="mb-5 text-ink/60">{t.cta.text}</p>
          <Link href={localePath(locale, "/contact")} className="btn-gold">
            {t.nav.contact}
          </Link>
        </div>
      </section>
    </>
  );
}
