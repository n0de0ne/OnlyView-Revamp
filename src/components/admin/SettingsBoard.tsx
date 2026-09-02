"use client";

import { useEffect, useState } from "react";
import { api, Card, Spinner, useToast } from "./ui";

const GROUPS: Array<{
  title: string;
  fields: Array<[key: string, label: string, hint?: string]>;
}> = [
  {
    title: "Tarifs hebdomadaires — Hiver (15 déc → 14 avr)",
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
    title: "Tarifs hebdomadaires — Été (1 juin → 31 août)",
    fields: [
      ["price_low_season_2", "2 chambres ($)"],
      ["price_low_season_3", "3 chambres ($)"],
      ["price_low_season_4", "4 chambres ($)"],
    ],
  },
  {
    title: "Forfaits festifs & règles",
    fields: [
      ["price_christmas", "Semaine de Noël ($)", "20–26 déc, forfait 7 nuits"],
      ["price_newyear", "Semaine du Nouvel An ($)", "27 déc–2 janv, forfait 7 nuits"],
      ["tax_rate", "Taxe de séjour (%)"],
      ["min_stay", "Séjour minimum (nuits)"],
      ["min_stay_peak", "Séjour min. festif (nuits)"],
      ["deposit_percent", "Acompte (%)"],
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
      ["villa_lat", "Latitude"],
      ["villa_lng", "Longitude"],
    ],
  },
];

export function SettingsBoard() {
  const { push } = useToast();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (res.success) push("Réglages enregistrés — appliqués immédiatement aux nouveaux calculs");
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
      <p className="text-xs text-slate-400">
        Les tarifs modifiés s&apos;appliquent aux nouveaux devis et aux réservations recalculées —
        jamais rétroactivement aux montants déjà enregistrés.
      </p>
    </div>
  );
}
