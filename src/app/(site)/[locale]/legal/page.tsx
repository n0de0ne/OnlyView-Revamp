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
    title: locale === "fr" ? "Mentions légales" : "Legal Notice",
    robots: { index: false },
    alternates: altLanguages("/legal"),
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const fr = locale === "fr";

  return (
    <>
      <PageHero title={fr ? "Mentions légales" : "Legal Notice"} />
      <section className="prose-sm mx-auto max-w-3xl px-5 py-16 leading-relaxed text-ink/75 lg:px-8">
        <h2 className="font-display mb-3 text-2xl text-ink">{fr ? "Éditeur" : "Publisher"}</h2>
        <p className="mb-8">
          Villa ONLY VIEW — SCI Efis
          <br />
          Pointe Milou, 97133 Saint-Barthélemy, France
          <br />
          contact@onlyviewstbarth.com
        </p>
        <h2 className="font-display mb-3 text-2xl text-ink">
          {fr ? "Location saisonnière" : "Seasonal rental"}
        </h2>
        <p className="mb-8">
          {fr
            ? "La location de la Villa ONLY VIEW est une location saisonnière meublée de courte durée régie par le droit applicable à Saint-Barthélemy. Un contrat de location est établi et signé pour chaque séjour ; un acompte de 30 % est demandé à la réservation, le solde 30 jours avant l'arrivée. Une taxe de séjour locale de 5 % s'applique."
            : "Villa ONLY VIEW is rented as a short-term furnished seasonal rental governed by the law applicable in Saint-Barthélemy. A rental agreement is issued and signed for every stay; a 30% deposit is due at booking and the balance 30 days before arrival. A 5% local tourist tax applies."}
        </p>
        <h2 className="font-display mb-3 text-2xl text-ink">
          {fr ? "Propriété intellectuelle" : "Intellectual property"}
        </h2>
        <p>
          {fr
            ? "L'ensemble des textes, photographies et éléments graphiques de ce site sont la propriété de la Villa ONLY VIEW et ne peuvent être reproduits sans autorisation écrite."
            : "All texts, photographs and graphic elements on this site are the property of Villa ONLY VIEW and may not be reproduced without written permission."}
        </p>
      </section>
    </>
  );
}
