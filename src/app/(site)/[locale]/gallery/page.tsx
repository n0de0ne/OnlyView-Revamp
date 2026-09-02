import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, imageGalleryJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getPhotos, PHOTO_CATEGORIES } from "@/lib/photos";
import { GalleryGrid } from "@/components/site/GalleryGrid";
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
    path: "/gallery",
    title: t.meta.titleGallery,
    description: t.meta.descGallery,
    image: "/media/photos/night/night-01.webp",
  });
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ locale: raw }, { c }] = await Promise.all([params, searchParams]);
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const photos = await getPhotos();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            imageGalleryJsonLd(locale, photos),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.gallery, url: locale === "fr" ? "/fr/gallery" : "/gallery" },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.nav.gallery}
        title={t.meta.titleGallery.split("—")[0].trim()}
        intro={t.meta.descGallery}
      />
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <p className="mb-10 max-w-3xl leading-relaxed text-ink/70">{t.galleryIntro}</p>
        <GalleryGrid
          photos={photos}
          categories={[...PHOTO_CATEGORIES]}
          labels={t.gallery.categories}
          allLabel={t.gallery.all}
          initialCategory={c}
          i18n={{
            close: t.gallery.close,
            prev: t.gallery.prev,
            next: t.gallery.next,
            of: t.gallery.of,
          }}
        />
      </section>
    </>
  );
}
