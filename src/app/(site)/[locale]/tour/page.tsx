import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getPhotos } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { TourExperience, type TourStop } from "@/components/site/TourExperience";
import { Tour3D } from "@/components/site/Tour3D";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 300;

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
    path: "/tour",
    title: t.meta.titleTour,
    description: t.meta.descTour,
    image: "/media/photos/living/living-01.webp",
  });
}

const STOP_ORDER: Array<{ key: string; cat: string }> = [
  { key: "exterior", cat: "exterior" },
  { key: "living", cat: "living" },
  { key: "kitchen", cat: "kitchen" },
  { key: "bedroom1", cat: "bedroom1" },
  { key: "bedroom2", cat: "bedroom2" },
  { key: "bedroom3", cat: "bedroom3" },
  { key: "bedroom4", cat: "bedroom4" },
  { key: "pool", cat: "pool-terrace" },
  { key: "night", cat: "night" },
];

export default async function TourPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const [photos, settings] = await Promise.all([getPhotos(), getSettings()]);
  const tour3dUrl = settings.tour_3d_url?.trim();

  const stops: TourStop[] = STOP_ORDER.map(({ key, cat }) => ({
    key,
    title: t.tour.stops[key]?.title ?? key,
    text: t.tour.stops[key]?.text ?? "",
    photos: photos.filter((p) => p.category === cat),
  })).filter((s) => s.photos.length > 0);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.tour, url: locale === "fr" ? "/fr/tour" : "/tour" },
            ])
          ),
        }}
      />
      <PageHero eyebrow={t.tour.label} title={t.tour.title} intro={t.tour.intro} />
      {tour3dUrl && (
        <Tour3D
          url={tour3dUrl}
          poster={stops[0]?.photos[0]}
          label={t.tour.threeD.label}
          title={t.tour.threeD.title}
          text={t.tour.threeD.text}
          cta={t.tour.threeD.cta}
        />
      )}
      <TourExperience stops={stops} locale={locale} bookCta={t.tour.bookCta} />
    </>
  );
}
