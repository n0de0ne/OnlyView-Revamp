import type { Metadata } from "next";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, pageMetadata, reviewsJsonLd } from "@/lib/seo";
import { getApprovedTestimonials } from "@/lib/testimonials";
import { formatDate } from "@/lib/dates";
import { PageHero } from "@/components/site/PageHero";
import { ReviewForm } from "@/components/site/ReviewForm";

// rendered per request: a build has no database, and an ISR snapshot of an
// empty reviews page would be what a crawler sees first after each deploy
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  return pageMetadata({
    locale,
    path: "/reviews",
    title: t.meta.titleReviews,
    description: t.meta.descReviews,
  });
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const reviews = await getApprovedTestimonials();
  const avg =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            ...reviewsJsonLd(
              reviews.map((r) => ({
                name: r.name,
                rating: r.rating,
                message: r.message,
                date: r.stayDate?.toISOString().slice(0, 10),
              }))
            ),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.reviews, url: localePath(locale, "/reviews") },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.nav.reviews}
        title={t.reviews.title}
        intro={
          avg
            ? `★ ${avg}/5 — ${reviews.length} ${locale === "fr" ? "avis" : "reviews"} · ${t.reviews.intro}`
            : t.reviews.intro
        }
      />
      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <div className="columns-1 gap-6 md:columns-2 [&>figure]:mb-6">
          {reviews.map((r) => (
            <figure key={r.id} className="break-inside-avoid border border-ink/10 bg-white p-7">
              <div className="mb-3 text-gold" aria-label={`${r.rating}/5`}>
                {"★".repeat(r.rating)}
                <span className="text-ink/15">{"★".repeat(5 - r.rating)}</span>
              </div>
              <blockquote className="font-display text-lg italic leading-relaxed text-ink/85">
                “{r.message}”
              </blockquote>
              <figcaption className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-ink/45">
                <span>
                  {r.name}
                  {r.country ? ` · ${r.country}` : ""}
                </span>
                {r.stayDate && <span>{formatDate(r.stayDate, locale, { month: "short", year: "numeric" })}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-14 max-w-2xl">
          <ReviewForm locale={locale} />
        </div>
      </section>
    </>
  );
}
