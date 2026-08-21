import type { Metadata } from "next";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { altLanguages } from "@/lib/seo";
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
    title: t.meta.titleWhyDirect,
    description: t.meta.descWhyDirect,
    alternates: altLanguages("/why-book-direct"),
  };
}

export default async function WhyDirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);

  return (
    <>
      <PageHero
        eyebrow={t.footer.directBadge}
        title={t.whyDirect.title}
        intro={t.meta.descWhyDirect}
      />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {t.whyDirect.items.map((item, i) => (
            <div key={i} className="border border-ink/10 bg-white p-8">
              <div className="font-display text-4xl text-gold/40">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-3 font-display text-2xl">{item.t}</h2>
              <p className="mt-3 leading-relaxed text-ink/70">{item.d}</p>
            </div>
          ))}
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
