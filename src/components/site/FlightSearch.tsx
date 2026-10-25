"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * "Find your flight" — a small form that opens Google Flights pre-filled.
 * Google has no public flights API; its `?q=` natural-language search is the
 * stable way in. The hop to SBH itself is booked separately (Winair,
 * St Barth Commuter from SXM; Tradewind from SJU), so the search targets the
 * gateway airport.
 */
const GATEWAYS = [
  { code: "SXM", en: "St Maarten (SXM)", fr: "St Maarten (SXM)" },
  { code: "SJU", en: "San Juan (SJU)", fr: "San Juan (SJU)" },
] as const;

const COPY = {
  en: {
    title: "Find your flight",
    intro: "Search Google Flights to your gateway, then add the short hop to St Barth (SBH).",
    from: "From",
    fromPlaceholder: "City or airport, e.g. New York",
    to: "To",
    depart: "Depart",
    back: "Return",
    travelers: "Travelers",
    submit: "Search on Google Flights",
  },
  fr: {
    title: "Trouvez votre vol",
    intro: "Cherchez sur Google Flights jusqu'à votre aéroport de correspondance, puis ajoutez le petit vol vers St Barth (SBH).",
    from: "Départ de",
    fromPlaceholder: "Ville ou aéroport, ex. Paris",
    to: "Vers",
    depart: "Aller",
    back: "Retour",
    travelers: "Voyageurs",
    submit: "Rechercher sur Google Flights",
  },
};

/** Google parses the English phrasing reliably whatever the UI language (`hl`). */
function query(from: string, to: string, depart: string, back: string, adults: number) {
  return [
    `Flights from ${from} to ${to}`,
    depart && `on ${depart}`,
    back && `through ${back}`,
    adults > 1 && `for ${adults} adults`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function FlightSearch({ locale }: { locale: Locale }) {
  const t = locale === "fr" ? COPY.fr : COPY.en;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState<string>("SXM");
  const [depart, setDepart] = useState("");
  const [back, setBack] = useState("");
  const [travelers, setTravelers] = useState(2);
  const today = new Date().toISOString().slice(0, 10);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query(from.trim(), to, depart, back, travelers);
    const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=${locale}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={submit} className="border border-ink/10 bg-white p-5 sm:p-6">
      <h3 className="font-display mb-1 text-2xl text-ink">{t.title}</h3>
      <p className="mb-5 text-sm text-ink/60">{t.intro}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="fs-from">{t.from} *</label>
          <input
            id="fs-from"
            required
            value={from}
            placeholder={t.fromPlaceholder}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fs-to">{t.to}</label>
          <select id="fs-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {GATEWAYS.map((g) => (
              <option key={g.code} value={g.code}>
                {g[locale === "fr" ? "fr" : "en"]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fs-depart">{t.depart}</label>
          <input
            id="fs-depart"
            type="date"
            min={today}
            value={depart}
            onChange={(e) => {
              setDepart(e.target.value);
              if (back && e.target.value > back) setBack("");
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="fs-back">{t.back}</label>
          <input
            id="fs-back"
            type="date"
            min={depart || today}
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fs-travelers">{t.travelers}</label>
          <select id="fs-travelers" value={travelers} onChange={(e) => setTravelers(Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-gold w-full">
            {t.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
