import type { Metadata } from "next";
import { Clock, Languages, MessageCircle } from "lucide-react";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, jsonLd, ownerJsonLd, pageMetadata, webPageJsonLd } from "@/lib/seo";
import { getContact } from "@/lib/contact";
import { EditorialHero } from "@/components/site/ov/EditorialHero";
import { ContactForm } from "@/components/site/ContactForm";

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
  const t = await getContent(locale);
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
      <EditorialHero eyebrow={t.nav.contact} title={t.contact.title} intro={t.contact.intro} />
      <section className="ov-shell grid gap-14 pb-20 md:pb-28 lg:grid-cols-12">
        <div className="ov-rule space-y-8 border-t pt-8 lg:col-span-5">
          <div>
            <h2 className="ov-label mb-3 text-gold-dark">{t.contact.emailLabel}</h2>
            <a href={`mailto:${email}`} className="break-all font-display text-[1.7rem] leading-tight text-ink hover:text-gold-dark md:text-3xl">
              {email}
            </a>
          </div>
          {whatsappUrl && (
            <div>
              <h2 className="ov-label mb-3 text-gold-dark">{t.contact.whatsapp}</h2>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ov-btn ov-btn-line"
              >
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.5} />
                {t.cta.whatsapp}
              </a>
            </div>
          )}
          <div className="ov-rule border-t pt-8">
            <h2 className="ov-label mb-3 text-gold-dark">{t.contactOwner.ownerTitle}</h2>
            <p className="leading-relaxed text-ink/75">{t.contactOwner.ownerText}</p>
            <ul className="mt-5 grid gap-3 text-sm text-ink/65 sm:grid-cols-2">
              <li className="flex items-center gap-2.5">
                <Clock aria-hidden className="h-[1.1rem] w-[1.1rem] shrink-0 text-gold" strokeWidth={1.25} />
                {t.contactOwner.responseTime}
              </li>
              <li className="flex items-center gap-2.5">
                <Languages aria-hidden className="h-[1.1rem] w-[1.1rem] shrink-0 text-gold" strokeWidth={1.25} />
                {t.contactOwner.languages}
              </li>
            </ul>
          </div>
          <div className="ov-rule ov-label border-t pt-8 leading-relaxed text-ink/55">
            Villa ONLY VIEW
            <br />
            Pointe Milou
            <br />
            97133 Saint-Barthélemy
            <br />
            French West Indies
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <ContactForm locale={locale} />
        </div>
      </section>
    </>
  );
}
