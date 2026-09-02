import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, lodgingBusinessJsonLd, pageMetadata, vacationRentalJsonLd } from "@/lib/seo";
import { getPhotos, firstOf } from "@/lib/photos";
import { getContact } from "@/lib/contact";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

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
    path: "/location",
    title: t.meta.titleLocation,
    description: t.meta.descLocation,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const fr = locale === "fr";
  const photos = await getPhotos();
  const { mapUrl, sameAs } = await getContact();

  const distances: Array<[string, string]> = fr
    ? [
        ["Aéroport Gustaf III (SBH)", "10 min"],
        ["Gustavia (port, boutiques)", "12 min"],
        ["Plage de Lorient", "5 min"],
        ["Plage de St-Jean", "8 min"],
        ["Supermarché (Oasis, Lorient)", "5 min"],
        ["Restaurants de Pointe Milou", "2 min"],
        ["Grand Cul-de-Sac (sports nautiques)", "7 min"],
        ["Saline / Gouverneur", "15–18 min"],
      ]
    : [
        ["Gustaf III Airport (SBH)", "10 min"],
        ["Gustavia (harbor, shopping)", "12 min"],
        ["Lorient Beach", "5 min"],
        ["St-Jean Beach", "8 min"],
        ["Supermarket (Oasis, Lorient)", "5 min"],
        ["Pointe Milou restaurants", "2 min"],
        ["Grand Cul-de-Sac (water sports)", "7 min"],
        ["Saline / Gouverneur beaches", "15–18 min"],
      ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            lodgingBusinessJsonLd(locale, sameAs),
            vacationRentalJsonLd({ locale, images: photos.slice(0, 4).map((p) => p.url), sameAs }),
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.location.title, url: localePath(locale, "/location") },
            ]),
          ]),
        }}
      />
      <PageHero
        eyebrow={t.location.label}
        title={t.location.title}
        intro={t.location.text}
        image={firstOf(photos, "night")}
      />
      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="section-title mb-8 !text-3xl">
              {fr ? "Distances depuis la villa" : "Distances from the villa"}
            </h2>
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {distances.map(([place, time]) => (
                <li key={place} className="flex items-center justify-between py-3.5 text-sm">
                  <span className="text-ink/80">{place}</span>
                  <span className="font-semibold text-gold">{time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Google Maps ↗
              </a>
              <Link href={localePath(locale, "/guide/getting-here")} className="btn-gold">
                {fr ? "Comment venir" : "Getting here"}
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            {firstOf(photos, "exterior") && (
              <Image
                src={firstOf(photos, "exterior")!.url}
                alt={firstOf(photos, "exterior")!.alt}
                width={900}
                height={600}
                sizes="(max-width:1024px) 100vw, 50vw"
                className="w-full object-cover"
              />
            )}
            <p className="text-sm leading-relaxed text-ink/60">
              {fr
                ? "Pointe Milou est une presqu'île résidentielle sur la côte nord de St Barth, connue pour son calme, ses villas de caractère et ses couchers de soleil — les plus beaux de l'île, disent les habitués."
                : "Pointe Milou is a residential peninsula on St Barth's north shore, known for its calm, its characterful villas and its sunsets — the island's finest, regulars say."}
            </p>
          </div>
        </div>
      </section>
      {/* The neighbourhood, named — the places people search for near here */}
      <section className="border-t border-ink/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <h2 className="section-title mb-5 !text-3xl">{t.nearby.title}</h2>
          <p className="mb-10 max-w-3xl leading-relaxed text-ink/70">{t.nearby.intro}</p>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {t.nearby.items.map(([place, detail]) => (
              <li key={place} className="border-t border-ink/10 pt-4">
                <span className="font-semibold text-ink">{place}</span>
                <span className="block text-sm text-ink/65">{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
