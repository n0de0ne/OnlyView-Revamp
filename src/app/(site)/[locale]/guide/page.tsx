import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, itemListJsonLd, jsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { getGuides } from "@/lib/guides";
import { EditorialHero } from "@/components/site/ov/EditorialHero";
import { ArrowUpRight } from "lucide-react";
import { KeyFacts } from "@/components/site/KeyFacts";

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
    path: "/guide",
    title: t.meta.titleGuide,
    description: t.meta.descGuide,
    image: "/media/photos/exterior/exterior-01.webp",
  });
}

export default async function GuideIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const [t, GUIDES] = await Promise.all([getContent(locale), getGuides()]);
  const fr = locale === "fr";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({
              locale,
              path: "/guide",
              name: fr ? "Guide St Barth" : "St Barth Guide",
              description: t.guideIntro,
              type: "CollectionPage",
            }),
            itemListJsonLd([
              {
                name: t.meta.titleLocation,
                url: localePath(locale, "/pointe-milou"),
                description: t.meta.descLocation,
              },
              { name: t.meta.titleMap, url: localePath(locale, "/map"), description: t.meta.descMap },
              ...GUIDES.map((g) => ({
                name: fr ? g.title.fr : g.title.en,
                url: localePath(locale, `/guide/${g.slug}`),
                description: fr ? g.description.fr : g.description.en,
              })),
            ]),
            breadcrumbJsonLd([
              { name: t.nav.home, url: fr ? "/fr" : "/" },
              { name: t.nav.guide, url: localePath(locale, "/guide") },
            ]),
          ]),
        }}
      />
      <EditorialHero
        eyebrow={t.nav.guide}
        title={fr ? "Guide St Barth" : "St Barth Guide"}
        intro={t.guideIntro}
        meta={`${GUIDES.length + 2} ${fr ? "chapitres" : "chapters"}`}
      />
      {/* the island in eleven lines — the block an answer engine quotes for "St Barth guide" */}
      <KeyFacts
        title={t.guideHub.factsTitle}
        label={t.guideHub.factsLabel}
        summary={t.guideHub.facts.slice(0, 4).map(([, d]) => d).join(" · ")}
        toggle={t.seo.factsToggle}
        facts={Object.fromEntries(t.guideHub.facts.map(([term, detail], i) => [String(i), [term, detail]]))}
        className="ov-rule border-y"
      />
      <section className="ov-shell py-20 md:py-28">
        {/* the two chapters closest to the villa, set apart */}
        <div className="grid gap-4 md:grid-cols-2">
          {([
            [localePath(locale, "/pointe-milou"), t.pointeMilou.label, t.guideHub.pointeMilouCard, t.guideHub.pointeMilouText, t.common.readMore],
            [localePath(locale, "/map"), t.map.label, fr ? "Carte interactive de l'île" : "Interactive island map", t.map.directoryIntro, t.nav.map],
          ] as const).map(([href, label, title, text, cta], i) => (
            <Link
              key={href}
              href={href}
              className={`group flex min-h-[20rem] flex-col justify-between rounded-2xl p-7 md:p-9 ${i === 0 ? "bg-sea text-white" : "bg-ivory text-ink"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className={`ov-label ${i === 0 ? "text-gold" : "text-gold-dark"}`}>{label}</p>
                <ArrowUpRight className="ov-arrow h-6 w-6 shrink-0" strokeWidth={1.25} aria-hidden />
              </div>
              <div>
                <h2 className="ov-h3 max-w-md">{title}</h2>
                <p className={`mt-3 max-w-md text-[0.95rem] leading-relaxed ${i === 0 ? "text-white/70" : "text-ink/65"}`}>{text}</p>
                <span className="ov-link mt-6">{cta}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* the other chapters, as a table of contents */}
        <ol className="ov-rule mt-16 border-t md:mt-24">
          {GUIDES.map((g, i) => (
            <li key={g.slug}>
              <Link
                href={localePath(locale, `/guide/${g.slug}`)}
                className="ov-rule group grid gap-3 border-b py-7 md:grid-cols-12 md:items-baseline md:gap-8 md:py-9"
              >
                <span className="ov-label text-ink/40 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <span className="ov-label text-gold-dark md:col-span-2">
                  {g.category === "practical" ? (fr ? "Pratique" : "Practical") : fr ? "L'île" : "The island"}
                </span>
                <span className="font-display text-[1.7rem] leading-tight text-ink transition group-hover:text-gold-dark md:col-span-5 md:text-[2rem]">
                  {fr ? g.title.fr : g.title.en}
                </span>
                <span className="text-[0.92rem] leading-relaxed text-ink/60 md:col-span-3">
                  {fr ? g.description.fr : g.description.en}
                </span>
                <ArrowUpRight className="ov-arrow hidden h-5 w-5 justify-self-end text-ink/50 md:col-span-1 md:block" strokeWidth={1.25} aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
