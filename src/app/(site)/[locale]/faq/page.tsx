import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { isLoyaltyEnabled } from "@/lib/features";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, faqJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { EditorialHero } from "@/components/site/ov/EditorialHero";

export const revalidate = 3600;

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
    path: "/faq",
    title: t.meta.titleFaq,
    description: t.meta.descFaq,
  });
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  const loyalty = await isLoyaltyEnabled();
  const items = t.faq.items.filter((i) => loyalty || i.tag !== "loyalty");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            faqJsonLd(items),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: "FAQ", url: localePath(locale, "/faq") },
            ]),
          ]),
        }}
      />
      <EditorialHero eyebrow="FAQ" title={t.faq.title} meta={`${items.length} questions`} />
      <section className="ov-shell pb-20 md:pb-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="ov-rule border-t lg:col-span-8">
            {items.map((item, i) => (
              <details key={i} className="ov-rule group border-b" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start gap-5 py-6 text-ink transition hover:text-gold-dark [&::-webkit-details-marker]:hidden">
                  <span className="ov-label w-7 shrink-0 pt-2 text-ink/40">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-display text-[1.45rem] leading-snug md:text-[1.7rem]">{item.q}</span>
                  <Plus
                    className="mt-2 h-5 w-5 shrink-0 text-gold-dark transition-transform duration-300 group-open:rotate-45"
                    strokeWidth={1.25}
                    aria-hidden
                  />
                </summary>
                <p className="ov-body max-w-2xl pb-7 pl-12">{item.a}</p>
              </details>
            ))}
          </div>
          <aside className="lg:col-span-3 lg:col-start-10">
            <div className="rounded-2xl bg-ivory p-6 lg:sticky lg:top-28">
              <p className="ov-label text-gold-dark">{t.nav.contact}</p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/70">{t.cta.text}</p>
              <Link href={localePath(locale, "/contact")} className="ov-btn ov-btn-ink mt-6">
                {t.nav.contact}
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
