import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent, getIcons } from "@/lib/site-content";
import { ICON_SLOTS } from "@/lib/icon-slots";
import { LineIcon } from "@/components/LineIcon";
import { breadcrumbJsonLd, jsonLd, pageMetadata, schemaImages, vacationRentalJsonLd } from "@/lib/seo";
import { getContact } from "@/lib/contact";
import { KeyFacts } from "@/components/site/KeyFacts";
import { getPhotos, firstOf } from "@/lib/photos";
import { EditorialHero, SectionHead } from "@/components/site/ov/EditorialHero";
import { ArrowUpRight } from "lucide-react";
import { Parallax } from "@/components/motion/Parallax";

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
    path: "/villa",
    title: t.meta.titleVilla,
    description: t.meta.descVilla,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function VillaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  const [photos, { sameAs }, icons] = await Promise.all([getPhotos(), getContact(), getIcons()]);

  const rooms: Array<{ cat: string; title: string; text: string }> = [
    { cat: "living", ...t.tour.stops.living },
    { cat: "kitchen", ...t.tour.stops.kitchen },
    { cat: "bedroom1", ...t.tour.stops.bedroom1 },
    { cat: "bedroom2", ...t.tour.stops.bedroom2 },
    { cat: "bedroom3", ...t.tour.stops.bedroom3 },
    { cat: "bedroom4", ...t.tour.stops.bedroom4 },
    { cat: "pool-terrace", ...t.tour.stops.pool },
  ];

  const amenities = (Object.keys(ICON_SLOTS.amenities.items) as Array<keyof typeof icons.amenities>).map(
    (k) => [icons.amenities[k], t.amenities[k]] as const
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            vacationRentalJsonLd({ locale, images: schemaImages(photos), sameAs }),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.villa, url: localePath(locale, "/villa") },
            ]),
          ]),
        }}
      />
      <EditorialHero
        eyebrow={t.intro.label}
        title={t.nav.villa}
        intro={t.meta.descVilla}
        image={firstOf(photos, "exterior")}
      />

      {/* the figures, as a ruled ledger (the same lines as the home page) */}
      <section className="ov-page" aria-label={t.seo.factsTitle}>
        <div className="ov-shell py-16 md:py-24">
          <dl className="ov-rule grid grid-cols-2 border-t lg:grid-cols-4">
            {t.intro.figures.map((f, i) => (
              <div
                key={f.value + i}
                className={`ov-rule reveal flex flex-col justify-between gap-6 border-b py-6 pr-4 md:min-h-[13rem] md:py-8 ${
                  i % 2 === 0 ? "border-r" : "pl-4 md:pl-8"
                } ${i > 0 && i % 2 === 0 ? "lg:pl-8" : ""} ${i === 1 ? "lg:border-r" : ""}`}
              >
                <dt className="sr-only">{f.text}</dt>
                <dd className="ov-num !text-[clamp(2.6rem,5vw,4.6rem)] text-ink/85">
                  {f.value.split(/([°²³])/).map((part, k) => (/^[°²³]$/.test(part) ? <sup key={k}>{part}</sup> : part))}
                </dd>
                <dd className="max-w-[16rem] text-[0.9rem] leading-snug text-ink/60" aria-hidden>
                  {f.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <KeyFacts title={t.seo.factsTitle}
        label={t.seo.factsLabel}
        summary={t.seo.factsSummary}
        toggle={t.seo.factsToggle}
        facts={t.seo.facts}
        icons={icons.facts}
        className="ov-rule border-y" />

      {/* the rooms: a numbered index, photographs alternating sides */}
      <section className="ov-page">
        <div className="ov-shell py-24 md:py-36">
          <SectionHead label={t.spaces.label} title={t.spaces.title} />
          <div className="space-y-20 md:space-y-32">
            {rooms.map((room, i) => {
              const photo = firstOf(photos, room.cat);
              if (!photo) return null;
              const flip = i % 2 === 1;
              return (
                <article key={room.cat} className="grid items-end gap-8 lg:grid-cols-12 lg:gap-10">
                  <Link
                    href={localePath(locale, `/gallery?c=${room.cat}`)}
                    className={`group reveal block lg:col-span-7 ${flip ? "lg:order-2 lg:col-start-6" : ""}`}
                    aria-label={`${room.title} — ${t.nav.gallery}`}
                  >
                    <Parallax className="ov-photo aspect-[4/3]">
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        width={1100}
                        height={825}
                        sizes="(max-width: 1024px) 100vw, 58vw"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </Parallax>
                  </Link>
                  <div className={`reveal lg:col-span-4 ${flip ? "lg:order-1 lg:col-start-1" : "lg:col-start-9"}`}>
                    <p className="ov-label text-gold-dark">
                      {String(i + 1).padStart(2, "0")} / {String(rooms.length).padStart(2, "0")}
                    </p>
                    <h3 className="ov-h3 mt-4 text-ink">{room.title}</h3>
                    <p className="ov-body mt-4 max-w-md">{room.text}</p>
                    <Link href={localePath(locale, `/gallery?c=${room.cat}`)} className="ov-link group mt-6 text-ink">
                      {t.nav.gallery}
                      <ArrowUpRight className="ov-arrow h-4 w-4" strokeWidth={1.4} aria-hidden />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* amenities, on the deep-sea panel */}
      <section className="bg-sea py-24 text-white md:py-32">
        <div className="ov-shell">
          <SectionHead label={t.amenities.label} title={t.amenities.title} light />
          <ul className="grid grid-cols-1 border-t border-white/12 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map(([icon, a]) => (
              <li key={a} className="flex items-center gap-4 border-b border-white/12 py-4 pr-6 text-[0.95rem] text-white/85">
                <LineIcon name={icon} />
                {a}
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold">
              {t.hero.cta}
            </Link>
            <Link href={localePath(locale, "/tour")} className="ov-btn ov-btn-glass">
              {t.spaces.tourCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
