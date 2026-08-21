import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n";
import { altLanguages } from "@/lib/seo";
import { PageHero } from "@/components/site/PageHero";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "fr" ? "Politique de confidentialité" : "Privacy Policy",
    robots: { index: false },
    alternates: altLanguages("/privacy"),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const fr = locale === "fr";

  const blocks: Array<[string, string]> = fr
    ? [
        [
          "Données collectées",
          "Nous collectons uniquement les données nécessaires au traitement de votre demande et de votre séjour : identité, coordonnées, dates de séjour, informations de facturation et, le cas échéant, signature du contrat. Aucune donnée n'est vendue ni transmise à des tiers à des fins commerciales.",
        ],
        [
          "Utilisation",
          "Vos données servent à gérer votre réservation, établir le contrat de location, communiquer avec vous avant et pendant le séjour, gérer votre compte fidélité et respecter nos obligations légales et comptables.",
        ],
        [
          "Conservation",
          "Les données de réservation sont conservées pendant la durée légale applicable aux documents contractuels et comptables, puis supprimées ou anonymisées.",
        ],
        [
          "Vos droits",
          "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition. Écrivez à contact@onlyviewstbarth.com — nous répondons sous 30 jours.",
        ],
        [
          "Cookies",
          "Ce site n'utilise pas de cookies publicitaires. Seuls des cookies techniques strictement nécessaires (session de l'espace client, préférence de langue) sont déposés.",
        ],
      ]
    : [
        [
          "Data we collect",
          "We only collect the data needed to process your inquiry and your stay: identity, contact details, stay dates, billing information and, where applicable, the contract signature. No data is sold or shared with third parties for marketing purposes.",
        ],
        [
          "How it is used",
          "Your data is used to manage your reservation, issue the rental agreement, communicate before and during your stay, run your loyalty account, and meet our legal and accounting obligations.",
        ],
        [
          "Retention",
          "Reservation data is kept for the legal retention period applicable to contractual and accounting records, then deleted or anonymized.",
        ],
        [
          "Your rights",
          "Under GDPR you may access, rectify, erase or object to the processing of your data. Write to contact@onlyviewstbarth.com — we answer within 30 days.",
        ],
        [
          "Cookies",
          "This site uses no advertising cookies. Only strictly necessary technical cookies are set (guest portal session, language preference).",
        ],
      ];

  return (
    <>
      <PageHero title={fr ? "Politique de confidentialité" : "Privacy Policy"} />
      <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
        {blocks.map(([h, p]) => (
          <div key={h} className="mb-8">
            <h2 className="font-display mb-3 text-2xl text-ink">{h}</h2>
            <p className="leading-relaxed text-ink/75">{p}</p>
          </div>
        ))}
      </section>
    </>
  );
}
