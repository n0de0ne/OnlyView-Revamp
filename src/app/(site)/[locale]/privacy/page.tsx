import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/PageHero";
import { AnalyticsOptOut } from "@/components/site/AnalyticsOptOut";
import { CookieSettingsLink } from "@/components/site/GoogleTags";
import { googleTagsConfig } from "@/lib/google-tags";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const fr = locale === "fr";
  return pageMetadata({
    locale,
    path: "/privacy",
    title: locale === "fr" ? "Politique de confidentialité" : "Privacy Policy",
    description: fr ? "Politique de confidentialité de la Villa ONLY VIEW." : "Privacy policy for Villa ONLY VIEW.",
    noindex: true,
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const fr = locale === "fr";
  const google = await googleTagsConfig().catch(() => null);
  const withGoogle = Boolean(google?.ga || google?.ads);

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
          "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition. Écrivez à annaerick971@gmail.com — nous répondons sous 30 jours.",
        ],
        [
          "Cookies",
          withGoogle
            ? "Sans votre accord, seuls des cookies techniques strictement nécessaires (session de l'espace client, préférence de langue, mémorisation de votre choix sur les cookies) et le cookie de mesure d'audience décrit ci-dessous sont déposés. Les cookies Google décrits plus bas ne le sont que si vous les acceptez."
            : "Ce site n'utilise pas de cookies publicitaires. Seuls des cookies techniques strictement nécessaires (session de l'espace client, préférence de langue) et le cookie de mesure d'audience décrit ci-dessous sont déposés.",
        ],
        [
          "Mesure d'audience",
          "Pour améliorer le site, nous mesurons sa fréquentation avec notre propre outil, sans aucun service tiers : pages vues, durée de visite, site ou moteur de provenance, type d'appareil et localisation approximative (pays, ville), calculée sur notre serveur à partir de l'adresse IP, qui n'est jamais enregistrée. Un cookie interne (ov_vid) reconnaît votre navigateur pendant 13 mois au maximum ; il ne sert à rien d'autre et n'est partagé avec personne. Les données détaillées sont effacées après 25 mois. Vous pouvez refuser cette mesure à tout moment ci-dessous.",
        ],
        ...(withGoogle
          ? ([
              [
                "Google Analytics et Google Ads",
                "Si vous les acceptez dans le bandeau, nous utilisons aussi Google Analytics et Google Ads (Google Ireland Ltd) pour mesurer l'efficacité de nos annonces et vous proposer la villa sur Google : pages vues, provenance, appareil, et les étapes clés (demande de réservation, contrat signé, message envoyé, avec leur montant). Google dépose ses cookies (_ga, _gcl…) pour 13 mois au maximum et peut transférer ces données hors de l'Union européenne. Votre nom, votre email et le contenu de vos messages ne sont jamais transmis. Votre choix est conservé 6 mois ; vous pouvez le modifier à tout moment ci-dessous.",
              ],
            ] as Array<[string, string]>)
          : []),
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
          "Under GDPR you may access, rectify, erase or object to the processing of your data. Write to annaerick971@gmail.com — we answer within 30 days.",
        ],
        [
          "Cookies",
          withGoogle
            ? "Without your consent, only strictly necessary technical cookies (guest portal session, language preference, remembering your cookie choice) and the audience-measurement cookie described below are set. The Google cookies described further down are set only if you accept them."
            : "This site uses no advertising cookies. Only strictly necessary technical cookies (guest portal session, language preference) and the audience-measurement cookie described below are set.",
        ],
        [
          "Audience measurement",
          "To improve the site we measure its traffic with our own tool, with no third-party service: pages viewed, visit length, the site or search engine you came from, device type and approximate location (country, city), worked out on our server from your IP address, which is never stored. A first-party cookie (ov_vid) recognises your browser for 13 months at most; it is used for nothing else and shared with no one. Detailed data is deleted after 25 months. You can opt out at any time below.",
        ],
        ...(withGoogle
          ? ([
              [
                "Google Analytics and Google Ads",
                "If you accept them in the banner, we also use Google Analytics and Google Ads (Google Ireland Ltd) to measure how our ads perform and show you the villa on Google: pages viewed, where you came from, device, and the key steps (booking request, signed contract, message sent, with their amount). Google sets its cookies (_ga, _gcl…) for 13 months at most and may transfer this data outside the European Union. Your name, email and the content of your messages are never sent. Your choice is kept for 6 months; you can change it at any time below.",
              ],
            ] as Array<[string, string]>)
          : []),
      ];

  return (
    <>
      <PageHero title={fr ? "Politique de confidentialité" : "Privacy Policy"} />
      <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
        {blocks.map(([h, p]) => (
          <div key={h} className="mb-8">
            <h2 className="font-display mb-3 text-2xl text-ink">{h}</h2>
            <p className="leading-relaxed text-ink/75">{p}</p>
            {(h === "Mesure d'audience" || h === "Audience measurement") && <AnalyticsOptOut fr={fr} />}
            {h.startsWith("Google") && (
              <CookieSettingsLink
                label={fr ? "Modifier mon choix sur les cookies Google" : "Change my Google cookie choice"}
                className="mt-4 border border-ink/20 px-4 py-2 text-sm text-ink transition hover:border-gold"
              />
            )}
          </div>
        ))}
        <p className="text-xs text-ink/45">
          {fr ? "Géolocalisation IP : " : "IP geolocation: "}
          <a href="https://db-ip.com" className="underline" rel="noopener">
            IP Geolocation by DB-IP
          </a>
        </p>
      </section>
    </>
  );
}
