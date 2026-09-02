import type { Metadata } from "next";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { breadcrumbJsonLd, jsonLd, ownerJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { getContact } from "@/lib/contact";
import { PageHero } from "@/components/site/PageHero";
import { ContactForm } from "@/components/site/ContactForm";

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
    path: "/contact",
    title: t.meta.titleContact,
    description: t.meta.descContact,
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const { email, whatsappUrl } = await getContact();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            webPageJsonLd({ locale, path: "/contact", name: t.contact.title, description: t.meta.descContact, type: "ContactPage" }),
            ownerJsonLd(locale),
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.contact, url: localePath(locale, "/contact") },
            ]),
          ]),
        }}
      />
      <PageHero eyebrow={t.nav.contact} title={t.contact.title} intro={t.contact.intro} />
      <section className="mx-auto grid max-w-5xl gap-14 px-5 py-16 lg:grid-cols-[1fr_1.3fr] lg:px-8">
        <div className="space-y-8">
          <div>
            <h2 className="eyebrow mb-3">{t.contact.emailLabel}</h2>
            <a href={`mailto:${email}`} className="font-display text-2xl text-ink hover:text-gold">
              {email}
            </a>
          </div>
          {whatsappUrl && (
            <div>
              <h2 className="eyebrow mb-3">{t.contact.whatsapp}</h2>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                💬 {t.cta.whatsapp}
              </a>
            </div>
          )}
          <div className="border-t border-ink/10 pt-8">
            <h2 className="eyebrow mb-3">{t.contactOwner.ownerTitle}</h2>
            <p className="leading-relaxed text-ink/75">{t.contactOwner.ownerText}</p>
            <dl className="mt-5 grid gap-2 text-sm text-ink/65 sm:grid-cols-2">
              <div>
                <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold">⏱</dt>
                <dd>{t.contactOwner.responseTime}</dd>
              </div>
              <div>
                <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold">🗣</dt>
                <dd>{t.contactOwner.languages}</dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-ink/10 pt-8 text-sm leading-relaxed text-ink/60">
            Villa ONLY VIEW
            <br />
            Pointe Milou
            <br />
            97133 Saint-Barthélemy
            <br />
            French West Indies
          </div>
        </div>
        <div>
          <ContactForm locale={locale} />
        </div>
      </section>
    </>
  );
}
