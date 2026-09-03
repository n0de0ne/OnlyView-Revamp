import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import {
  DEFAULT_OG_IMAGE,
  organizationJsonLd,
  ownerJsonLd,
  pageMetadata,
  websiteJsonLd,
  faqJsonLd,
  jsonLd,
  lodgingBusinessJsonLd,
  vacationRentalJsonLd,
} from "@/lib/seo";
import { getPhotos, firstOf } from "@/lib/photos";
import { isLoyaltyEnabled } from "@/lib/features";
import { getContact } from "@/lib/contact";
import { getRateConfig } from "@/lib/settings";
import { getApprovedTestimonials } from "@/lib/testimonials";
import { usd } from "@/lib/money";
import { HomeHero } from "@/components/site/HomeHero";
import { KeyFacts } from "@/components/site/KeyFacts";

export const revalidate = 60;

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
    path: "/",
    title: t.meta.titleHome,
    description: t.meta.descHome,
    image: DEFAULT_OG_IMAGE,
    imageAlt: t.badges.pool,
    absoluteTitle: true,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);

  const [loyalty, photos, rates, testimonials, contact] = await Promise.all([
    isLoyaltyEnabled(),
    getPhotos(),
    getRateConfig(),
    getApprovedTestimonials(3),
    getContact(),
  ]);
  const { whatsappUrl, sameAs } = contact;

  const spaces = [
    { cat: "living", title: t.spaces.living, desc: t.spaces.livingDesc },
    { cat: "pool-terrace", title: t.spaces.pool, desc: t.spaces.poolDesc },
    { cat: "bedroom1", title: t.spaces.bedrooms, desc: t.spaces.bedroomsDesc },
    { cat: "kitchen", title: t.spaces.kitchen, desc: t.spaces.kitchenDesc },
    { cat: "night", title: t.spaces.night, desc: t.spaces.nightDesc },
    { cat: "exterior", title: t.spaces.exterior, desc: t.spaces.exteriorDesc },
  ];

  const amenities = [
    ["📶", t.amenities.wifi],
    ["❄️", t.amenities.ac],
    ["🏊", t.amenities.pool],
    ["🍳", t.amenities.kitchen],
    ["🔊", t.amenities.sonos],
    ["📺", t.amenities.tv],
    ["🔥", t.amenities.bbq],
    ["🚗", t.amenities.parking],
    ["🔐", t.amenities.safe],
    ["🛎️", t.amenities.concierge],
    ["🧹", t.amenities.housekeeping],
    ["🛏️", t.amenities.linens],
  ] as const;

  const heroImage = firstOf(photos, "pool-terrace");
  const avgRating =
    testimonials.length > 0
      ? testimonials.reduce((s, r) => s + r.rating, 0) / testimonials.length
      : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            organizationJsonLd(sameAs),
            ownerJsonLd(locale),
            websiteJsonLd(locale),
            vacationRentalJsonLd({
              locale,
              images: photos.slice(0, 10).map((p) => p.url),
              ratingValue: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
              reviewCount: testimonials.length || undefined,
              sameAs,
            }),
            lodgingBusinessJsonLd(locale, sameAs),
            faqJsonLd(t.faq.items.filter((i) => loyalty || i.tag !== "loyalty").slice(0, 6)),
          ]),
        }}
      />

      <HomeHero
        locale={locale}
        tagline={t.hero.tagline}
        location={t.hero.location}
        cta={t.hero.cta}
        discover={t.hero.discover}
        headingSuffix={t.seo.headingSuffix}
        fallbackImage={heroImage?.url ?? "/media/photos/pool-terrace/pool-terrace-01.webp"}
      />

      {/* Intro */}
      <section id="intro" className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="reveal">
            <p className="eyebrow mb-4">{t.intro.label}</p>
            <h2 className="section-title mb-7">{t.intro.title}</h2>
            <p className="max-w-xl leading-relaxed text-ink/70">{t.intro.text}</p>

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-ink/80 sm:grid-cols-2">
              {[t.badges.bedrooms, t.badges.guests, t.badges.pool, t.badges.view].map((b) => (
                <div key={b} className="flex items-center gap-2.5">
                  <span className="h-px w-6 bg-gold" aria-hidden />
                  {b}
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href={localePath(locale, "/booking")} className="btn-gold">
                {t.intro.cta}
              </Link>
              <Link href={localePath(locale, "/tour")} className="btn-outline">
                {t.nav.tour}
              </Link>
            </div>
          </div>

          <div className="relative reveal">
            {firstOf(photos, "living") && (
              <Image
                src={firstOf(photos, "living")!.url}
                alt={firstOf(photos, "living")!.alt}
                width={880}
                height={620}
                className="w-full object-cover shadow-2xl shadow-ink/20"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            )}
            <div className="absolute -bottom-6 -left-6 hidden bg-night px-7 py-5 text-white lg:block">
              <div className="font-display text-3xl text-gold">200 m²</div>
              <div className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-white/70">
                {t.intro.stat_sunset}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The facts, in plain text — what answer engines quote */}
      <KeyFacts title={t.seo.factsTitle}
        label={t.seo.factsLabel}
        summary={t.seo.factsSummary}
        toggle={t.seo.factsToggle}
        facts={t.seo.facts} />

      {/* Spaces */}
      <section className="bg-sand-dark py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-4">{t.spaces.label}</p>
              <h2 className="section-title">{t.spaces.title}</h2>
            </div>
            <Link href={localePath(locale, "/tour")} className="btn-outline">
              {t.spaces.tourCta}
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s, i) => {
              const photo = firstOf(photos, s.cat);
              if (!photo) return null;
              return (
                <Link
                  key={s.cat}
                  href={localePath(locale, `/gallery?c=${s.cat}`)}
                  className={`group relative block overflow-hidden reveal ${
                    i === 0 ? "sm:col-span-2 sm:row-span-2" : ""
                  }`}
                >
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    width={i === 0 ? 1200 : 640}
                    height={i === 0 ? 900 : 480}
                    sizes={i === 0 ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"}
                    className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                      i === 0 ? "aspect-[4/3] h-full" : "aspect-[4/3]"
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6">
                    <h3 className="font-display text-2xl text-white">{s.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/70">
                      {s.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <p className="eyebrow mb-4 text-center">{t.amenities.label}</p>
        <h2 className="section-title mb-14 text-center">{t.amenities.title}</h2>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {amenities.map(([icon, label]) => (
            <li
              key={label}
              className="flex items-center gap-3.5 border-b border-ink/8 pb-4 text-sm text-ink/80"
            >
              <span aria-hidden className="text-xl">
                {icon}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="bg-night py-24 text-white lg:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <p className="eyebrow mb-4 text-center">{t.testimonials.label}</p>
            <h2 className="section-title mb-14 text-center !text-white">
              {t.testimonials.title}
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {testimonials.map((r) => (
                <figure key={r.id} className="border border-white/10 p-8 reveal">
                  <div className="mb-4 text-gold" aria-label={`${r.rating}/5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-white/20">{"★".repeat(5 - r.rating)}</span>
                  </div>
                  <blockquote className="font-display text-lg italic leading-relaxed text-white/85">
                    “{r.message}”
                  </blockquote>
                  <figcaption className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">
                    {r.name}
                    {r.country ? ` · ${r.country}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link href={localePath(locale, "/reviews")} className="btn-outline-light">
                {t.testimonials.cta}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Rates teaser */}
      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-4">{t.ratesTeaser.label}</p>
            <h2 className="section-title mb-6">{t.ratesTeaser.title}</h2>
            <p className="max-w-md leading-relaxed text-ink/70">{loyalty ? t.ratesTeaser.note : t.ratesTeaser.noteNoLoyalty}</p>
            <Link href={localePath(locale, "/rates")} className="btn-gold mt-8">
              {t.ratesTeaser.cta}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t.rates.seasonNames.lowSeason, price: rates.lowSeason[2] },
              { label: t.rates.seasonNames.summer, price: rates.summer[2] },
              { label: t.rates.seasonNames.winter, price: rates.winter[2] },
            ].map((s) => (
              <div key={s.label} className="border border-ink/10 bg-white p-6 text-center">
                <div className="text-[0.65rem] uppercase tracking-[0.25em] text-ink/50">
                  {s.label}
                </div>
                <div className="mt-3 font-display text-3xl text-ink">
                  {usd(s.price)}
                </div>
                <div className="mt-1 text-xs text-ink/50">
                  {t.ratesTeaser.from} · {t.ratesTeaser.perWeek}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="bg-sand-dark py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
          <div className="order-2 lg:order-1">
            {firstOf(photos, "night") && (
              <Image
                src={firstOf(photos, "night")!.url}
                alt={firstOf(photos, "night")!.alt}
                width={880}
                height={620}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full object-cover shadow-xl"
              />
            )}
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow mb-4">{t.location.label}</p>
            <h2 className="section-title mb-6">{t.location.title}</h2>
            <p className="max-w-lg leading-relaxed text-ink/70">{t.location.text}</p>
            <ul className="mt-8 space-y-3 text-sm text-ink/80">
              {[t.location.airport, t.location.beach, t.location.gustavia, t.location.restaurants].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden />
                    {item}
                  </li>
                )
              )}
            </ul>
            <Link href={localePath(locale, "/location")} className="btn-outline mt-9">
              {t.location.mapCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-28 text-center text-white">
        {firstOf(photos, "pool-terrace") && (
          <Image
            src={photos.filter((p) => p.category === "pool-terrace").at(-1)!.url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-night/70" />
        <div className="relative mx-auto max-w-2xl px-5">
          <h2 className="section-title !text-white">{t.cta.title}</h2>
          <p className="mt-5 text-white/80">{t.cta.text}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link href={localePath(locale, "/booking")} className="btn-gold">
              {t.cta.button}
            </Link>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-light"
              >
                {t.cta.whatsapp}
              </a>
            ) : (
              <Link href={localePath(locale, "/contact")} className="btn-outline-light">
                {t.cta.whatsapp}
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
