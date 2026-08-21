/**
 * St Barth guide — evergreen content hub (SEO/GEO).
 * Condensed from the legacy site's content pages; structured so AI engines
 * and search can quote clean facts (headings + short paragraphs).
 */
export interface GuideSection {
  h: string;
  p: string[];
}

export interface GuideArticle {
  slug: string;
  category: string;
  title: { en: string; fr: string };
  description: { en: string; fr: string };
  sections: { en: GuideSection[]; fr: GuideSection[] };
}

export const GUIDES: GuideArticle[] = [
  {
    slug: "getting-here",
    category: "practical",
    title: {
      en: "Getting to St Barth (and to the villa)",
      fr: "Venir à St Barth (et jusqu'à la villa)",
    },
    description: {
      en: "Flights via St Maarten, the famous SBH landing, ferries, and the 10-minute drive to Pointe Milou — everything about reaching Villa ONLY VIEW.",
      fr: "Vols via St Maarten, le fameux atterrissage à SBH, les ferries et les 10 minutes de route jusqu'à Pointe Milou — tout pour rejoindre la Villa ONLY VIEW.",
    },
    sections: {
      en: [
        {
          h: "By air — the classic route",
          p: [
            "Most guests fly long-haul into St Maarten (SXM), then take a 10-minute connecting flight to St Barth's Gustaf III Airport (SBH) with Winair, St Barth Commuter or Tradewind Aviation. The short hop over the channel — and the landing between the hills of St Jean — is part of the experience.",
            "Tradewind also flies direct from San Juan (SJU), a smooth option from the US East Coast. Private charters can be arranged from SXM, SJU and Antigua.",
          ],
        },
        {
          h: "By sea",
          p: [
            "Ferries (Voyager, Great Bay Express) connect St Maarten to Gustavia in 45–90 minutes. It's the budget-friendly and weather-proof alternative when the last SBH flight is gone.",
          ],
        },
        {
          h: "From the airport to Pointe Milou",
          p: [
            "The villa is a 10-minute drive from the airport. Most guests rent a small car (recommended on the island's steep roads) — we can have it delivered to the villa. Prefer not to drive? The concierge arranges your taxi and any transfers.",
            "Check-in is from 3 pm; early arrival can often be accommodated — ask via your guest portal.",
          ],
        },
      ],
      fr: [
        {
          h: "En avion — la route classique",
          p: [
            "La plupart des voyageurs atterrissent à St Maarten (SXM), puis prennent un vol de 10 minutes vers l'aéroport Gustaf III de St Barth (SBH) avec Winair, St Barth Commuter ou Tradewind Aviation. Ce petit saut au-dessus du canal — et l'atterrissage entre les collines de St Jean — fait partie de l'expérience.",
            "Tradewind propose aussi des vols directs depuis San Juan (SJU), pratique depuis la côte Est des États-Unis. Des charters privés existent depuis SXM, SJU et Antigua.",
          ],
        },
        {
          h: "Par la mer",
          p: [
            "Les ferries (Voyager, Great Bay Express) relient St Maarten à Gustavia en 45 à 90 minutes. C'est l'option économique, fiable par tous les temps quand le dernier vol SBH est parti.",
          ],
        },
        {
          h: "De l'aéroport à Pointe Milou",
          p: [
            "La villa est à 10 minutes de route de l'aéroport. La plupart des hôtes louent une petite voiture (recommandé sur les routes pentues de l'île) — nous pouvons la faire livrer à la villa. Vous préférez ne pas conduire ? La conciergerie organise taxi et transferts.",
            "Arrivée à partir de 15 h ; un early check-in est souvent possible — demandez-le via votre espace client.",
          ],
        },
      ],
    },
  },
  {
    slug: "best-beaches",
    category: "island",
    title: {
      en: "The best beaches of St Barth, from Pointe Milou",
      fr: "Les plus belles plages de St Barth, depuis Pointe Milou",
    },
    description: {
      en: "Sixteen beaches, no bad choices: our honest shortlist — Lorient, St Jean, Gouverneur, Saline, Colombier — with drive times from Villa ONLY VIEW.",
      fr: "Seize plages, aucun mauvais choix : notre sélection honnête — Lorient, St Jean, Gouverneur, Saline, Colombier — avec les temps de route depuis la Villa ONLY VIEW.",
    },
    sections: {
      en: [
        {
          h: "The everyday beaches (5–8 min)",
          p: [
            "Lorient (5 min) is the villa's local beach: calm mornings, a surf break at the far end, and the Oasis supermarket nearby for picnic supplies. St Jean (8 min) is the lively one — Nikki Beach, Eden Rock, boutiques and turquoise shallows.",
          ],
        },
        {
          h: "The wild south (15–18 min)",
          p: [
            "Gouverneur and Saline are the postcard beaches: no buildings, no clubs, just white sand and blue water. Saline's short walk over the dune keeps it uncrowded. Go late afternoon and stay for the light.",
          ],
        },
        {
          h: "Worth the detour",
          p: [
            "Colombier is reached by boat or a 25-minute coastal walk — the reward is St Barth's most private bay. Grand Cul-de-Sac (7 min) is the lagoon for kitesurf, paddling, and turtle-spotting; Shell Beach in Gustavia is made of shells and sunsets.",
          ],
        },
      ],
      fr: [
        {
          h: "Les plages du quotidien (5–8 min)",
          p: [
            "Lorient (5 min) est la plage « maison » de la villa : matinées calmes, un spot de surf à l'extrémité, et le supermarché Oasis à côté pour le pique-nique. St Jean (8 min) est la plage animée — Nikki Beach, Eden Rock, boutiques et eaux turquoise.",
          ],
        },
        {
          h: "Le sud sauvage (15–18 min)",
          p: [
            "Gouverneur et Saline sont les plages de carte postale : aucune construction, aucun club, juste du sable blanc et une eau bleue. La petite marche par la dune de Saline la garde préservée. Allez-y en fin d'après-midi, restez pour la lumière.",
          ],
        },
        {
          h: "Valent le détour",
          p: [
            "Colombier s'atteint en bateau ou par un sentier côtier de 25 minutes — la récompense : la baie la plus privée de St Barth. Grand Cul-de-Sac (7 min) est le lagon du kitesurf, du paddle et des tortues ; Shell Beach à Gustavia est faite de coquillages et de couchers de soleil.",
          ],
        },
      ],
    },
  },
  {
    slug: "best-restaurants",
    category: "island",
    title: {
      en: "Where to eat: our St Barth restaurant shortlist",
      fr: "Où manger : notre sélection de restaurants à St Barth",
    },
    description: {
      en: "From beach clubs to gastronomy: the restaurants we actually book for our guests — including sunset dinners two minutes from the villa.",
      fr: "Des beach clubs à la gastronomie : les restaurants que nous réservons vraiment pour nos hôtes — dont des dîners au coucher du soleil à deux minutes de la villa.",
    },
    sections: {
      en: [
        {
          h: "Two minutes from the villa",
          p: [
            "Pointe Milou's own address is legendary for sunset cocktails, live music and Mediterranean dinner above the bay. Book the first service and watch the sky do its show from your table.",
          ],
        },
        {
          h: "Beach lunches",
          p: [
            "Shellona (Shell Beach), Gyp Sea and La Guérite set the tone for barefoot lunches; Nikki Beach in St Jean is the party version. For a quieter toes-in-sand lunch, the Grand Cul-de-Sac lagoon spots are 7 minutes away.",
          ],
        },
        {
          h: "Gustavia nights",
          p: [
            "Bonito (Franco-Latin, harbour views), Orega (Franco-Japanese) and L'Isola (Italian) anchor Gustavia's dinner scene. Tables go fast in season — our concierge books ahead for every stay, just send your wishlist.",
          ],
        },
      ],
      fr: [
        {
          h: "À deux minutes de la villa",
          p: [
            "L'adresse emblématique de Pointe Milou est réputée pour ses cocktails au coucher du soleil, sa musique live et sa cuisine méditerranéenne au-dessus de la baie. Réservez le premier service et regardez le ciel faire son spectacle depuis votre table.",
          ],
        },
        {
          h: "Déjeuners de plage",
          p: [
            "Shellona (Shell Beach), Gyp Sea et La Guérite donnent le ton des déjeuners pieds nus ; Nikki Beach à St Jean en est la version festive. Pour un déjeuner plus calme, les adresses du lagon de Grand Cul-de-Sac sont à 7 minutes.",
          ],
        },
        {
          h: "Les soirs à Gustavia",
          p: [
            "Bonito (franco-latino, vue sur le port), Orega (franco-japonais) et L'Isola (italien) tiennent la scène des dîners à Gustavia. Les tables partent vite en saison — notre conciergerie réserve en amont pour chaque séjour, envoyez simplement vos envies.",
          ],
        },
      ],
    },
  },
  {
    slug: "seasons",
    category: "practical",
    title: {
      en: "St Barth seasons: when to come",
      fr: "Les saisons de St Barth : quand venir",
    },
    description: {
      en: "Winter glamour, summer value, festive weeks: an honest guide to St Barth's seasons, weather and prices — and when Villa ONLY VIEW books out.",
      fr: "L'hiver glamour, l'été avantageux, les semaines festives : un guide honnête des saisons, de la météo et des prix à St Barth — et des périodes où la Villa ONLY VIEW affiche complet.",
    },
    sections: {
      en: [
        {
          h: "Winter (Dec 15 – Apr 14) — the classic",
          p: [
            "Dry, breezy, 27–29°C: this is St Barth's signature season, and the villa's most requested. Christmas and New Year weeks are sold as 7-night packages and book out up to a year ahead.",
          ],
        },
        {
          h: "Mid-season (Apr–May, Sep–mid Dec) — the connoisseur's pick",
          p: [
            "The island exhales: same weather, fewer people, softer rates. May and November are our favorite months — restaurant tables are easy, beaches are quiet, sunsets unchanged.",
          ],
        },
        {
          h: "Summer (Jun – Aug) — the value season",
          p: [
            "Warm water, longer days and the lowest rates of the year (from $10,000/week for 2 bedrooms). August is lively with the locals' festivals. Hurricane risk is insurable — and the villa's hillside position keeps it breezy.",
          ],
        },
      ],
      fr: [
        {
          h: "L'hiver (15 déc – 14 avr) — le classique",
          p: [
            "Sec, ventilé, 27–29 °C : c'est la saison signature de St Barth, et la plus demandée à la villa. Les semaines de Noël et du Nouvel An se vendent en forfaits de 7 nuits et se réservent jusqu'à un an à l'avance.",
          ],
        },
        {
          h: "La mi-saison (avr–mai, sep–mi-déc) — le choix des connaisseurs",
          p: [
            "L'île respire : même météo, moins de monde, tarifs plus doux. Mai et novembre sont nos mois préférés — les tables de restaurant sont faciles, les plages tranquilles, les couchers de soleil inchangés.",
          ],
        },
        {
          h: "L'été (juin – août) — la saison maligne",
          p: [
            "Eau chaude, journées longues et les tarifs les plus bas de l'année (dès 10 000 $/semaine en 2 chambres). Août vit au rythme des fêtes locales. Le risque cyclonique s'assure — et la position en colline de la villa la garde ventilée.",
          ],
        },
      ],
    },
  },
];

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
