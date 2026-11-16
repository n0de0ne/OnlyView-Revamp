import type { Metadata } from "next";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, jsonLd, pageMetadata, reviewsJsonLd } from "@/lib/seo";
import { getApprovedTestimonials } from "@/lib/testimonials";
import { formatDate } from "@/lib/dates";
import { EditorialHero } from "@/components/site/ov/EditorialHero";
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
  const t = await getContent(locale);
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
  const t = await getContent(locale);
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
      <EditorialHero
        eyebrow={t.nav.reviews}
        title={t.reviews.title}
        intro={t.reviews.intro}
        meta={avg ? `★ ${avg}/5 · ${reviews.length} ${locale === "fr" ? "avis" : "reviews"}` : undefined}
      />
      <section className="ov-shell pb-20 md:pb-28">
        <div className="ov-rule columns-1 gap-12 border-t pt-4 md:columns-2 [&>figure]:mb-4">
          {reviews.map((r) => (
            <figure key={r.id} className="ov-rule break-inside-avoid border-b py-8">
              <div className="mb-4 text-sm tracking-[0.25em] text-gold" aria-label={`${r.rating}/5`}>
                {"★".repeat(r.rating)}
                <span className="text-ink/15">{"★".repeat(5 - r.rating)}</span>
              </div>
              <blockquote className="font-display text-[1.3rem] italic leading-[1.45] text-ink/85">
                “{r.message}”
              </blockquote>
              <figcaption className="ov-label mt-6 flex items-center justify-between gap-4 text-ink/45">
                <span>
                  {r.name}
                  {r.country ? ` · ${r.country}` : ""}
                </span>
                {r.stayDate && <span>{formatDate(r.stayDate, locale, { month: "short", year: "numeric" })}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-20 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ReviewForm locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
