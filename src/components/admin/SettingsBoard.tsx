"use client";

import { useEffect, useState } from "react";
import { api, Card, Spinner, useToast } from "./ui";
import { RemindersPanel } from "./RemindersPanel";

const GROUPS: Array<{
  title: string;
  fields: Array<[key: string, label: string, hint?: string]>;
}> = [
  {
    title: "Tarifs hebdomadaires — Hiver",
    fields: [
      ["price_winter_2", "2 chambres ($)"],
      ["price_winter_3", "3 chambres ($)"],
      ["price_winter_4", "4 chambres ($)"],
    ],
  },
  {
    title: "Tarifs hebdomadaires — Mi-saison",
    fields: [
      ["price_summer_2", "2 chambres ($)"],
      ["price_summer_3", "3 chambres ($)"],
      ["price_summer_4", "4 chambres ($)"],
    ],
  },
  {
    title: "Tarifs hebdomadaires — Été",
    fields: [
      ["price_low_season_2", "2 chambres ($)"],
      ["price_low_season_3", "3 chambres ($)"],
      ["price_low_season_4", "4 chambres ($)"],
    ],
  },
  {
    title: "Forfaits festifs & règles",
    fields: [
      ["price_christmas", "Semaine de Noël ($)", "forfait 7 nuits"],
      ["price_newyear", "Semaine du Nouvel An ($)", "forfait 7 nuits"],
      ["tax_rate", "Taxe de séjour (%)"],
      ["min_stay", "Séjour minimum (nuits)"],
      ["min_stay_peak", "Séjour min. festif (nuits)"],
      ["deposit_percent", "Acompte (%)"],
    ],
  },
  {
    title: "Dates des saisons (MM-JJ, inclus)",
    fields: [
      ["season_winter_start", "Hiver — début", "défaut 12-15"],
      ["season_winter_end", "Hiver — fin", "défaut 04-14"],
      ["season_low_start", "Été — début", "défaut 06-01"],
      ["season_low_end", "Été — fin", "défaut 08-31"],
      ["season_christmas_start", "Noël — début", "défaut 12-20"],
      ["season_christmas_end", "Noël — fin", "défaut 12-26"],
      ["season_newyear_start", "Nouvel An — début", "défaut 12-27"],
      ["season_newyear_end", "Nouvel An — fin", "défaut 01-02 · le reste de l'année = mi-saison. Semaines d'événement : menu Tarifs par date"],
    ],
  },
  {
    title: "Rappels automatiques",
    fields: [
      [
        "reminders_enabled",
        "Rappels actifs",
        "1 = envoyés automatiquement chaque heure · 0 = aucun envoi (défaut)",
      ],
      ["reminder_option", "Options qui expirent", "1 = rappel au client la veille + alerte à vous le jour J"],
      [
        "reminder_option_release",
        "Libérer les options expirées",
        "1 = l'option passe en « Annulé » et les dates se libèrent · 0 = alerte seulement",
      ],
      ["reminder_balance", "Solde à régler", "1 = rappel au client avant l'échéance (J-30 de l'arrivée) + alerte à vous si en retard"],
      ["reminder_balance_days", "Rappel du solde — jours avant l'échéance", "défaut 7"],
      ["reminder_prearrival", "Email avant l'arrivée", "1 = infos pratiques + lien pour remplir vols et invités, commander des extras"],
      ["reminder_prearrival_days", "Avant l'arrivée — jours", "défaut 10"],
      ["reminder_review", "Demande d'avis après le séjour", "1 = activé"],
      ["reminder_review_days", "Demande d'avis — jours après le départ", "défaut 2"],
    ],
  },
  {
    title: "Programme de fidélité",
    fields: [
      [
        "loyalty_enabled",
        "Programme actif",
        "1 = affiché partout (site, espace client, back-office) · 0 = masqué et suspendu",
      ],
      ["loyalty_earn_per_dollar", "Points par $ payé", "0.01 = 1 point / 100 $"],
      ["loyalty_point_value", "Valeur d'un point ($)"],
      ["loyalty_min_redeem", "Utilisation minimum (points)"],
      ["loyalty_max_redeem_percent", "Max. du séjour payable en points (%)"],
    ],
  },
  {
    title: "Statistiques de visite (Analytique)",
    fields: [
      ["analytics_enabled", "Mesure d'audience", "1 = active (défaut) · 0 = plus rien n'est enregistré"],
      [
        "analytics_cookie",
        "Reconnaître les visiteurs qui reviennent",
        "1 = cookie interne de 13 mois, sans bandeau (exemption CNIL de mesure d'audience, défaut) · 0 = aucun cookie : un visiteur n'est reconnu que le jour même",
      ],
    ],
  },
  {
    title: "Analyse de rentabilité",
    fields: [
      ["cost_cleaning_per_day_eur", "Ménage (€/jour)"],
      ["cost_fixed_monthly_eur", "Charges fixes (€/mois)", "internet + jardinier + moustiques + électricité + eau"],
      ["eur_usd_rate", "Taux EUR→USD"],
    ],
  },
  {
    title: "Contrat & banque",
    fields: [
      ["owner_name", "Nom du propriétaire"],
      ["bank_account_name", "Titulaire du compte"],
      ["bank_account_number", "Numéro de compte"],
      ["bank_name", "Banque"],
      ["bank_iban", "IBAN"],
      ["bank_bic", "BIC/SWIFT"],
    ],
  },
  {
    title: "Visite 3D",
    fields: [
      [
        "tour_3d_url",
        "Lien de la visite 3D",
        "Visite immersive (Giraffe360, Matterport…) intégrée sur la page Visite virtuelle. Vider pour la masquer.",
      ],
    ],
  },
  {
    title: "Contact & villa",
    fields: [
      ["contact_email", "Email de contact"],
      ["contact_phone", "Téléphone"],
      ["contact_whatsapp", "WhatsApp (numéro int.)"],
      ["villa_address", "Adresse"],
      ["villa_map_url", "Lien Google Maps"],
      ["social_instagram", "Instagram (URL)"],
      ["social_facebook", "Facebook (URL)"],
      ["social_tripadvisor", "TripAdvisor (URL)"],
      ["social_google", "Fiche Google Business (URL)"],
      ["social_youtube", "YouTube (URL)"],
      [
        "listing_urls",
        "Annonces de la villa chez les agences (URLs)",
        "Les pages de la villa sur les sites des agences et plateformes (WIMCO, Eden Rock Villa Rental, Airbnb, Corcoran…), séparées par des espaces. Google et les moteurs IA relient ainsi ces annonces à ce site comme une seule et même villa — et ce site comme son adresse officielle.",
      ],
      ["google_site_verification", "Google Search Console (code de vérification)"],
      ["bing_site_verification", "Bing Webmaster (code de vérification)"],
      ["villa_lat", "Latitude"],
      ["villa_lng", "Longitude"],
    ],
  },
];

export function SettingsBoard() {
  const { push } = useToast();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    api<{ settings: Record<string, string> }>("/api/admin/settings").then(
      (d) => d.success && setSettings(d.settings)
    );
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await api("/api/admin/settings", { method: "PUT", json: { settings } });
    setSaving(false);
    if (res.success) {
      push("Réglages enregistrés — appliqués immédiatement aux nouveaux calculs");
      setSavedAt(Date.now());
    }
    else push(`Erreur : ${res.error}`, "error");
  };

  if (!settings) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Réglages</h1>
        <button onClick={save} disabled={saving} className="abtn-primary">
          {saving ? "Enregistrement…" : "💾 Enregistrer tout"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.title} title={g.title}>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map(([key, label, hint]) => (
                <div key={key} className="afield">
                  <label>{label}</label>
                  <input
                    value={settings[key] ?? ""}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                  {hint && <span className="text-[0.65rem] text-slate-400">{hint}</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <RemindersPanel key={savedAt} />
      <p className="text-xs text-slate-400">
        Les tarifs modifiés s&apos;appliquent aux nouveaux devis et aux réservations recalculées —
        jamais rétroactivement aux montants déjà enregistrés.
      </p>
    </div>
  );
}
