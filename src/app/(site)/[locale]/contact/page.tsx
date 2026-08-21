import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "@/lib/i18n";
import { altLanguages } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { PageHero } from "@/components/site/PageHero";
import { ContactForm } from "@/components/site/ContactForm";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    title: t.meta.titleContact,
    description: t.meta.descContact,
    alternates: altLanguages("/contact"),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  let email = "contact@onlyviewstbarth.com";
  let whatsapp = "";
  try {
    const s = await getSettings();
    email = s.contact_email ?? email;
    whatsapp = s.contact_whatsapp ?? "";
  } catch {
    // defaults
  }

  return (
    <>
      <PageHero eyebrow={t.nav.contact} title={t.contact.title} intro={t.contact.intro} />
      <section className="mx-auto grid max-w-5xl gap-14 px-5 py-16 lg:grid-cols-[1fr_1.3fr] lg:px-8">
        <div className="space-y-8">
          <div>
            <h2 className="eyebrow mb-3">{t.contact.emailLabel}</h2>
            <a href={`mailto:${email}`} className="font-display text-2xl text-ink hover:text-gold">
              {email}
            </a>
          </div>
          {whatsapp && (
            <div>
              <h2 className="eyebrow mb-3">{t.contact.whatsapp}</h2>
              <a
                href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                💬 {t.cta.whatsapp}
              </a>
            </div>
          )}
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
