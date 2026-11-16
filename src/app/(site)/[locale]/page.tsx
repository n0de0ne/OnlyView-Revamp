import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GoldenHour } from "@/components/site/golden-hour/GoldenHour";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent, getIcons, villaFacts } from "@/lib/site-content";
import { ICON_SLOTS } from "@/lib/icon-slots";
import { LineIcon } from "@/components/LineIcon";
import {
  DEFAULT_OG_IMAGE,
  organizationJsonLd,
  ownerJsonLd,
  pageMetadata,
  websiteJsonLd,
  faqJsonLd,
  jsonLd,
  schemaImages,
  vacationRentalJsonLd,
} from "@/lib/seo";
import { getPhotos, firstOf } from "@/lib/photos";
import { isLoyaltyEnabled } from "@/lib/features";
import { getContact } from "@/lib/contact";
import { getRateConfig } from "@/lib/settings";
import { getApprovedTestimonials } from "@/lib/testimonials";
import { usd } from "@/lib/money";
import { Masthead } from "@/components/site/ov/Masthead";
import { SectionHead } from "@/components/site/ov/EditorialHero";
import { KeyFacts } from "@/components/site/KeyFacts";
import { Testimonials } from "@/components/site/ov/Testimonials";

export const revalidate = 60;

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
  const t = await getContent(locale);
  const villa = villaFacts();

  const [loyalty, photos, rates, testimonials, contact, icons] = await Promise.all([
    isLoyaltyEnabled(),
    getPhotos(),
    getRateConfig(),
    getApprovedTestimonials(5),
    getContact(),
    getIcons(),
  ]);
  const { whatsappUrl, sameAs } = contact;

  const spaces = [
    { cat: "pool-terrace", title: t.spaces.pool, desc: t.spaces.poolDesc },
    { cat: "living", title: t.spaces.living, desc: t.spaces.livingDesc },
    { cat: "bedroom1", title: t.spaces.bedrooms, desc: t.spaces.bedroomsDesc },
    { cat: "kitchen", title: t.spaces.kitchen, desc: t.spaces.kitchenDesc },
    { cat: "exterior", title: t.spaces.exterior, desc: t.spaces.exteriorDesc },
  ]
    .map((s) => ({ ...s, photo: firstOf(photos, s.cat) }))
    .filter((s) => s.photo);

  const amenityKeys = Object.keys(ICON_SLOTS.amenities.items) as Array<keyof typeof icons.amenities>;
  const amenities = amenityKeys.map((k) => [icons.amenities[k], t.amenities[k]] as const);

  const heroImage = firstOf(photos, "pool-terrace");
  const nightImage = firstOf(photos, "night");
  // the spaces below open on the first living-room photo: the introduction takes another
  const livingImage = photos.filter((p) => p.category === "living")[1] ?? firstOf(photos, "living");
  const closingImage = photos.filter((p) => p.category === "pool-terrace").at(-1);
  const avgRating =
    testimonials.length > 0 ? testimonials.reduce((s, r) => s + r.rating, 0) / testimonials.length : undefined;

  const seasons = [
    { label: t.rates.seasonNames.lowSeason, price: rates.lowSeason[2] },
    { label: t.rates.seasonNames.summer, price: rates.summer[2] },
    { label: t.rates.seasonNames.winter, price: rates.winter[2] },
  ];

  return (
    <div className="ov-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            organizationJsonLd(sameAs),
            ownerJsonLd(locale),
            websiteJsonLd(locale),
            vacationRentalJsonLd({
              locale,
              images: schemaImages(photos),
              ratingValue: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
              reviewCount: testimonials.length || undefined,
              sameAs,
              reviews: testimonials.map((r) => ({
                name: r.name,
                rating: r.rating,
                message: r.message,
                date: r.stayDate?.toISOString().slice(0, 10),
              })),
            }),
            faqJsonLd(t.faq.items.filter((i) => loyalty || i.tag !== "loyalty").slice(0, 6)),
          ]),
        }}
      />

      <Masthead
        locale={locale}
        location={t.hero.location}
        tagline={t.hero.tagline}
        cta={t.hero.cta}
        discover={t.hero.discover}
        headingSuffix={t.seo.headingSuffix}
        fallbackImage={heroImage?.url ?? "/media/photos/pool-terrace/pool-terrace-01.webp"}
        sunsetLabel={t.hero.sunsetTonight}
        sunsetEyebrow={t.goldenHour.eyebrow}
        sunsetText={t.spaces.nightDesc}
        sunsetImage={nightImage}
        lat={villa.lat}
        lng={villa.lng}
      />

      {/* ── 01 · The promise: an editorial introduction and a pair of views ── */}
      <section id="intro" className="ov-shell scroll-mt-20 py-24 md:py-36">
        <p className="ov-label mb-8 text-ink/55">
          <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
          {t.intro.label}
        </p>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="reveal lg:col-span-9">
            <h2 className="ov-h2 max-w-5xl text-ink">{t.intro.title}</h2>
            <p className="ov-intro mt-8 max-w-5xl text-ink/75">{t.intro.text}</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href={localePath(locale, "/villa")} className="ov-btn ov-btn-ink">
                {t.intro.cta}
              </Link>
              <Link href={localePath(locale, "/tour")} className="ov-btn ov-btn-line">
                {t.nav.tour}
              </Link>
            </div>
          </div>
          <ul className="reveal grid grid-cols-2 content-end gap-x-6 gap-y-4 lg:col-span-3 lg:grid-cols-1">
            {(["bedrooms", "guests", "pool", "view"] as const).map((k) => (
              <li key={k} className="ov-rule flex items-center gap-3 border-t pt-4 text-sm text-ink/80">
                <LineIcon name={icons.badges[k]} className="h-5 w-5 text-gold-dark" />
                {t.badges[k]}
              </li>
            ))}
          </ul>
        </div>

        {/* two photographs of unequal weight, hung at different heights */}
        <div className="mt-16 grid grid-cols-12 gap-4 md:mt-24 md:gap-6">
          {livingImage && (
            <figure className="reveal col-span-12 md:col-span-7">
              <div className="ov-photo relative aspect-[4/3]">
                <Image src={livingImage.url} alt={livingImage.alt} fill sizes="(max-width: 768px) 100vw, 58vw" className="object-cover" />
              </div>
              <figcaption className="ov-label mt-3 text-ink/50">{t.spaces.living}</figcaption>
            </figure>
          )}
          {nightImage && (
            <figure className="reveal col-span-10 col-start-3 md:col-span-4 md:col-start-9 md:mt-40">
              <div className="ov-photo relative aspect-[4/5]">
                <Image src={nightImage.url} alt={nightImage.alt} fill sizes="(max-width: 768px) 84vw, 33vw" className="object-cover" />
              </div>
              <figcaption className="ov-label mt-3 text-ink/50">{t.intro.stat_sunset}</figcaption>
            </figure>
          )}
        </div>
      </section>

      {/* ── 02 · The figures: a staggered ledger, not a row of small stats ── */}
      <section className="ov-shell pb-24 md:pb-36" aria-label={t.seo.factsTitle}>
        {/* two columns from the phone up: four tall single rows read as a list on a phone */}
        <div className="ov-rule grid grid-cols-2 border-t">
          {t.intro.figures.map((f, i) => (
            <div
              key={f.value + i}
              className={`ov-rule reveal flex min-h-[11rem] flex-col justify-between gap-4 border-b py-5 md:min-h-[22rem] md:gap-8 md:py-7 ${
                i % 2 === 0 ? "border-r pr-4 md:pr-10" : "pl-4 md:pl-10 md:pt-24"
              }`}
            >
              <span className="ov-num !text-[clamp(3.1rem,12.5vw,9.5rem)] text-ink/85">
                {/* ° and ² as small raised marks, not the font's oversized glyphs */}
                {f.value.split(/([°²³])/).map((part, k) => (/^[°²³]$/.test(part) ? <sup key={k}>{part}</sup> : part))}
              </span>
              <span className="max-w-xs text-[0.84rem] leading-snug text-ink/60 md:text-[0.95rem]">{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03 · The spaces: a hanging gallery of unequal images ── */}
      <section className="bg-ivory py-24 md:py-36">
        <div className="ov-shell">
          <SectionHead
            label={t.spaces.label}
            title={t.spaces.title}
            aside={
              <Link href={localePath(locale, "/tour")} className="ov-btn ov-btn-line">
                {t.spaces.tourCta}
              </Link>
            }
          />
          {/* a phone gets a swipeable row of tall frames (as in a listing app);
              wider screens the hanging gallery of unequal images */}
          <div className="scroll-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-12 md:gap-x-6 md:gap-y-20 md:overflow-visible md:px-0 md:pb-0">
            {spaces.map((s, i) => {
              // lead image wide, the rest alternate sides and sizes
              const layout = [
                "col-span-12 md:col-span-8",
                "col-span-12 md:col-span-4 md:mt-48",
                "col-span-12 md:col-span-5 md:col-start-2",
                "col-span-12 md:col-span-5 md:col-start-8 md:mt-32",
                "col-span-12 md:col-span-7 md:col-start-4",
              ][i];
              const ratio = [
                "md:aspect-[16/11]",
                "md:aspect-[3/4]",
                "md:aspect-[4/5]",
                "md:aspect-[4/3]",
                "md:aspect-[16/9]",
              ][i];
              return (
                <Link
                  key={s.cat}
                  href={localePath(locale, `/gallery?c=${s.cat}`)}
                  className={`group reveal block w-[78%] shrink-0 snap-start md:w-auto ${layout}`}
                >
                  <div className={`ov-photo relative aspect-[4/5] ${ratio}`}>
                    <Image
                      src={s.photo!.url}
                      alt={s.photo!.alt}
                      fill
                      sizes={i === 0 ? "(max-width: 768px) 80vw, 66vw" : "(max-width: 768px) 80vw, 42vw"}
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-6">
                    <div>
                      <h3 className="ov-h3 text-ink">{s.title}</h3>
                      <p className="mt-1.5 max-w-sm text-sm text-ink/60">{s.desc}</p>
                    </div>
                    <ArrowUpRight className="ov-arrow mt-1 h-7 w-7 shrink-0 text-ink/70" strokeWidth={1} aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 04 · The view, live: Alan's golden-hour scene ── */}
      <div id="golden-hour" className="scroll-mt-0">
        <GoldenHour labels={t.goldenHour} photos={photos} />
      </div>

      {/* ── 05 · Amenities: a ruled list with the gold line icons ── */}
      <section className="ov-shell py-24 md:py-32">
        <SectionHead label={t.amenities.label} title={t.amenities.title} />
        <ul className="ov-rule grid border-t sm:grid-cols-2 lg:grid-cols-4">
          {amenities.map(([icon, label], i) => (
            <li
              key={label}
              className={`ov-rule flex items-center gap-4 border-b py-5 text-[0.95rem] text-ink/80 sm:pr-6 ${
                i % 4 !== 3 ? "lg:border-r" : ""
              } ${i % 4 !== 0 ? "lg:pl-6" : ""}`}
            >
              <LineIcon name={icon} className="h-6 w-6 shrink-0 text-gold-dark" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* The facts, in plain text — what answer engines quote */}
      <KeyFacts
        title={t.seo.factsTitle}
        label={t.seo.factsLabel}
        summary={t.seo.factsSummary}
        toggle={t.seo.factsToggle}
        facts={t.seo.facts}
        icons={icons.facts}
        className="!bg-paper"
      />

      {/* ── 06 · Proof: one quote at a time, as a typographic event ── */}
      {testimonials.length > 0 && (
        <Testimonials
          label={t.testimonials.label}
          title={t.testimonials.title}
          cta={t.testimonials.cta}
          href={localePath(locale, "/reviews")}
          items={testimonials.map((r) => ({
            id: r.id,
            name: r.name,
            country: r.country,
            rating: r.rating,
            message: r.message,
          }))}
        />
      )}

      {/* ── 07 · Rates & location: a deep-sea panel beside a photograph ── */}
      <section className="ov-shell grid gap-4 py-24 md:gap-6 md:py-32 lg:grid-cols-2">
        <div className="reveal flex min-h-[34rem] flex-col justify-between rounded-lg bg-sea p-7 text-white md:p-10">
          <div>
            <p className="ov-label text-white/55">{t.ratesTeaser.label}</p>
            <h2 className="ov-h2 mt-5 max-w-md">{t.ratesTeaser.title}</h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
              {loyalty ? t.ratesTeaser.note : t.ratesTeaser.noteNoLoyalty}
            </p>
          </div>
          <div>
            <dl className="ov-rule-light mb-8 border-t">
              {seasons.map((s) => (
                <div key={s.label} className="ov-rule-light flex items-baseline justify-between gap-4 border-b py-3.5">
                  <dt className="ov-label text-white/60">{s.label}</dt>
                  <dd className="text-right">
                    <span className="mr-2 text-xs text-white/50">{t.ratesTeaser.from}</span>
                    <span className="font-display text-3xl">{usd(s.price)}</span>
                    <span className="ml-1 text-xs text-white/50">{t.ratesTeaser.perWeek}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-3">
              <Link href={localePath(locale, "/rates")} className="ov-btn ov-btn-glass">
                {t.ratesTeaser.cta}
              </Link>
              <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
                {t.hero.cta}
              </Link>
            </div>
          </div>
        </div>

        <Link
          href={localePath(locale, "/pointe-milou")}
          className="group reveal relative flex min-h-[34rem] flex-col justify-between overflow-hidden rounded-lg p-7 text-white md:p-10"
        >
          {nightImage && (
            <div className="ov-photo absolute inset-0">
              <Image src={(firstOf(photos, "exterior") ?? nightImage).url} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" aria-hidden />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/15 to-black/65" />
          <div className="relative">
            <p className="ov-label text-white/70">{t.location.label}</p>
            <h2 className="ov-h2 mt-5">{t.location.title}</h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/85">{t.location.text}</p>
          </div>
          <div className="relative">
            <ul className="mb-8 grid gap-2 text-sm text-white/90 sm:grid-cols-2">
              {(["airport", "beach", "gustavia", "restaurants"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2.5">
                  <LineIcon name={icons.location[k]} className="h-[1.05rem] w-[1.05rem] text-gold-light" />
                  {t.location[k]}
                </li>
              ))}
            </ul>
            <span className="ov-btn ov-btn-glass">
              {t.location.mapCta}
              <ArrowUpRight className="ov-arrow" aria-hidden />
            </span>
          </div>
        </Link>
      </section>

      {/* ── 08 · The invitation ── */}
      <section className="relative overflow-hidden bg-night text-white">
        {closingImage && (
          <Image src={closingImage.url} alt="" fill sizes="100vw" className="object-cover opacity-45" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/20" />
        <div className="ov-shell relative grid gap-10 py-28 md:py-40 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="ov-label text-white/55">{t.hero.location}</p>
            <h2 className="ov-h1 mt-6">{t.cta.title}</h2>
            <p className="ov-intro mt-6 max-w-xl text-white/80">{t.cta.text}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
                {t.cta.button}
              </Link>
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="ov-btn ov-btn-glass">
                  {t.cta.whatsapp}
                </a>
              ) : (
                <Link href={localePath(locale, "/contact")} className="ov-btn ov-btn-glass">
                  {t.cta.whatsapp}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
