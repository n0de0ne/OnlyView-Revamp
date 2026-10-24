/**
 * St Barth guide — evergreen content hub (SEO/GEO).
 * Condensed from the legacy site's content pages; structured so AI engines
 * and search can quote clean facts (headings + short paragraphs).
 */
export interface GuideSection {
  h: string;
  p: string[];
  /** map-places.json slugs shown under the section, each linking to /map#slug */
  places?: string[];
  /** render the Google Flights search form after this section */
  flightSearch?: boolean;
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
      en: "Flights via St Maarten (SXM) or San Juan (SJU), the famous SBH landing, ferries, VIP transfers and the 10-minute drive to Pointe Milou — everything about reaching Villa ONLY VIEW.",
      fr: "Vols via St Maarten (SXM) ou San Juan (SJU), le fameux atterrissage à SBH, les ferries, les transferts VIP et les 10 minutes de route jusqu'à Pointe Milou — tout pour rejoindre la Villa ONLY VIEW.",
    },
    sections: {
      en: [
        {
          h: "By air — two gateways: SXM or SJU",
          p: [
            "There are two ways in. Most guests fly long-haul into St Maarten (SXM), then take a 10-minute connecting flight to St Barth's Gustaf III Airport (SBH) with Winair or St Barth Commuter. The short hop over the channel — and the landing between the hills of St Jean — is part of the experience.",
            "The other gateway is San Juan, Puerto Rico (SJU), a smooth option from the US. From SJU the connection to SBH is Tradewind Aviation — note that Tradewind flies from San Juan only, not from St Maarten. Private charters can be arranged from either gateway.",
          ],
          flightSearch: true,
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
        {
          h: "Transfers & VIP services",
          p: [
            "Let the concierge handle the journey: airport and ferry transfers, private charter flights between SXM or SJU and St Barth, and VIP assistance on arrival. Send your flight details from your guest portal and everything is lined up before you land.",
          ],
        },
      ],
      fr: [
        {
          h: "En avion — deux portes d'entrée : SXM ou SJU",
          p: [
            "Il y a deux façons d'arriver. La plupart des voyageurs atterrissent à St Maarten (SXM), puis prennent un vol de 10 minutes vers l'aéroport Gustaf III de St Barth (SBH) avec Winair ou St Barth Commuter. Ce petit saut au-dessus du canal — et l'atterrissage entre les collines de St Jean — fait partie de l'expérience.",
            "L'autre porte d'entrée est San Juan, à Porto Rico (SJU), pratique depuis les États-Unis. Depuis SJU, la correspondance vers SBH se fait avec Tradewind Aviation — attention, Tradewind ne vole que depuis San Juan, pas depuis St Maarten. Des charters privés sont possibles depuis l'une ou l'autre.",
          ],
          flightSearch: true,
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
        {
          h: "Transferts & services VIP",
          p: [
            "Confiez le trajet à la conciergerie : transferts aéroport et ferry, vols charter privés entre SXM ou SJU et St Barth, et assistance VIP à l'arrivée. Envoyez vos horaires de vol depuis votre espace client, tout est organisé avant votre atterrissage.",
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
      fr: "Plages de St Barth, vues de Pointe Milou",
    },
    description: {
      en: "Sixteen beaches, no bad choices: our honest shortlist — Lorient, St Jean, Gouverneur, Saline, Toiny, Colombier — with drive times from Villa ONLY VIEW.",
      fr: "Seize plages, aucun mauvais choix : notre sélection — Lorient, St Jean, Gouverneur, Saline, Toiny, Colombier — avec les temps de route depuis la Villa ONLY VIEW.",
    },
    sections: {
      en: [
        {
          h: "The everyday beaches (5–8 min)",
          p: [
            "Lorient (5 min) is the villa's local beach: calm mornings, a surf break at the far end, and the Oasis supermarket nearby for picnic supplies. St Jean (8 min) is the lively one — Nikki Beach, Eden Rock, boutiques and turquoise shallows.",
          ],
          places: ["lorient-beach", "st-jean-beach-restaurants-side"],
        },
        {
          h: "The wild south (15–18 min)",
          p: [
            "Gouverneur and Saline are the postcard beaches: no buildings, no clubs, just white sand and blue water. Saline's short walk over the dune keeps it uncrowded. Go late afternoon and stay for the light.",
          ],
          places: ["gouverneur-beach", "saline-beach"],
        },
        {
          h: "Toiny — the wild east, and a beach club lunch",
          p: [
            "On the Atlantic side, Toiny is raw and dramatic: rolling waves, rocky coves and almost nobody around — beautiful for a walk and photos rather than a swim. Below the cliff, the beach club of the Hotel Le Toiny is one of the island's loveliest lunches: barefoot tables under the sea grapes, grilled fish and a pool by the sand. Reservations are a must — ask the concierge.",
          ],
          places: ["toiny-beach"],
        },
        {
          h: "Worth the detour",
          p: [
            "Colombier is reached by boat or a 25-minute coastal walk — the reward is St Barth's most private bay. Grand Cul-de-Sac (7 min) is the lagoon for kitesurf, paddling, and turtle-spotting; Shell Beach in Gustavia is made of shells and sunsets.",
          ],
          places: ["anse-de-colombier", "grand-cul-de-sac", "shell-beach"],
        },
      ],
      fr: [
        {
          h: "Les plages du quotidien (5–8 min)",
          p: [
            "Lorient (5 min) est la plage « maison » de la villa : matinées calmes, un spot de surf à l'extrémité, et le supermarché Oasis à côté pour le pique-nique. St Jean (8 min) est la plage animée — Nikki Beach, Eden Rock, boutiques et eaux turquoise.",
          ],
          places: ["lorient-beach", "st-jean-beach-restaurants-side"],
        },
        {
          h: "Le sud sauvage (15–18 min)",
          p: [
            "Gouverneur et Saline sont les plages de carte postale : aucune construction, aucun club, juste du sable blanc et une eau bleue. La petite marche par la dune de Saline la garde préservée. Allez-y en fin d'après-midi, restez pour la lumière.",
          ],
          places: ["gouverneur-beach", "saline-beach"],
        },
        {
          h: "Toiny — l'est sauvage, et un déjeuner au beach club",
          p: [
            "Côté Atlantique, Toiny est brute et spectaculaire : rouleaux, criques rocheuses et presque personne — idéale pour marcher et photographier plutôt que pour nager. Au pied de la falaise, le beach club de l'Hôtel Le Toiny offre l'un des plus beaux déjeuners de l'île : tables pieds nus sous les raisiniers, poisson grillé et piscine au bord du sable. Réservation indispensable — demandez à la conciergerie.",
          ],
          places: ["toiny-beach"],
        },
        {
          h: "Valent le détour",
          p: [
            "Colombier s'atteint en bateau ou par un sentier côtier de 25 minutes — la récompense : la baie la plus privée de St Barth. Grand Cul-de-Sac (7 min) est le lagon du kitesurf, du paddle et des tortues ; Shell Beach à Gustavia est faite de coquillages et de couchers de soleil.",
          ],
          places: ["anse-de-colombier", "grand-cul-de-sac", "shell-beach"],
        },
      ],
    },
  },
  {
    slug: "best-restaurants",
    category: "island",
    title: {
      en: "Where to eat in St Barth: our top picks",
      fr: "Où manger à St Barth : nos coups de cœur",
    },
    description: {
      en: "Sushi, Italian, French brasserie, beach lunches and fine dining: our favourite restaurants in St Barth — Bonito, L'Isola, Ti'Corail, L'Esprit and more — and why every table on the island is worth trying.",
      fr: "Sushi, italien, brasserie française, déjeuners de plage et gastronomie : nos restaurants préférés à St Barth — Bonito, L'Isola, Ti'Corail, L'Esprit et d'autres — et pourquoi chaque table de l'île vaut le détour.",
    },
    sections: {
      en: [
        {
          h: "Our top picks — a starting point, not a limit",
          p: [
            "These are the tables we send our own friends to. But St Barth has one of the Caribbean's best restaurant scenes for its size: every restaurant here is worth trying, and each has its own vibe. Use this list as a first evening's plan, then explore.",
          ],
        },
        {
          h: "Lunch",
          p: [
            "Ti'Corail is a must: a tiny lunch-only spot on the beach at Grand Cul-de-Sac, with a daily menu of local seafood and Caribbean spices — book ahead, there are only a handful of tables. For a quick, easy lunch in Gustavia, La Cantina has the harbour view. For more of a French brasserie vibe, Le Repaire on the port is the classic.",
            "Want your toes in the sand? The beach club of the Hotel Le Toiny is one of the island's loveliest lunches (see our beaches guide).",
          ],
          places: ["la-cantina", "le-repaire"],
        },
        {
          h: "Sushi & Italian",
          p: [
            "For sushi, Barry, the rooftop above Gustavia's harbour, serves Japanese-Peruvian plates, ceviches and sushi from 6 pm. For Italian, L'Isola is the address — authentic cooking and fresh homemade pasta. Its little sister, L'Isoletta, is the place for pizza.",
          ],
          places: ["barry", "lisola", "lisoletta"],
        },
        {
          h: "Dinner to remember",
          p: [
            "For a fancy dinner, Bonito: French technique with South American flavours, overlooking Gustavia harbour. For a great French dinner, L'Esprit (chef Jean-Claude Dufour) in Saline serves seasonal French cuisine in a tropical garden.",
            "Tables go fast in season — our concierge books ahead for every stay, just send your wishlist from your guest portal.",
          ],
          places: ["bonito", "lesprit"],
        },
        {
          h: "And many more",
          p: [
            "Two minutes from the villa, Pointe Milou's own address is legendary for sunset cocktails, live music and Mediterranean dinner above the bay — book the first service and watch the sky do its show. For barefoot beach lunches, Shellona (Shell Beach), Gyp Sea and La Guérite set the tone; Nikki Beach in St Jean is the party version. Open the island map to see every restaurant we know, with drive times from the villa.",
          ],
          places: ["christo", "shellona", "gypsea", "la-guerite", "nikki-beach"],
        },
      ],
      fr: [
        {
          h: "Nos coups de cœur — un point de départ, pas une limite",
          p: [
            "Ce sont les tables où nous envoyons nos propres amis. Mais pour sa taille, St Barth a l'une des plus belles scènes gastronomiques des Caraïbes : chaque restaurant de l'île vaut le détour et a sa propre ambiance. Prenez cette liste comme un premier programme, puis explorez.",
          ],
        },
        {
          h: "Le déjeuner",
          p: [
            "Ti'Corail est incontournable : une minuscule adresse ouverte uniquement le midi, sur la plage de Grand Cul-de-Sac, avec une carte du jour de produits de la mer et d'épices caribéennes — réservez, il n'y a qu'une poignée de tables. Pour un déjeuner simple et rapide à Gustavia, La Cantina offre la vue sur le port. Pour une ambiance plus brasserie française, Le Repaire, sur le port, est le classique.",
            "Envie d'avoir les pieds dans le sable ? Le beach club de l'Hôtel Le Toiny offre l'un des plus beaux déjeuners de l'île (voir notre guide des plages).",
          ],
          places: ["la-cantina", "le-repaire"],
        },
        {
          h: "Sushi & italien",
          p: [
            "Pour les sushis, Barry, le rooftop au-dessus du port de Gustavia, sert à partir de 18 h une cuisine japono-péruvienne, ceviches et sushis. Côté italien, L'Isola est l'adresse — cuisine authentique et pâtes fraîches maison. Sa petite sœur, L'Isoletta, est l'endroit pour la pizza.",
          ],
          places: ["barry", "lisola", "lisoletta"],
        },
        {
          h: "Un dîner mémorable",
          p: [
            "Pour un dîner chic, Bonito : technique française et saveurs sud-américaines, face au port de Gustavia. Pour un très bon dîner français, L'Esprit (chef Jean-Claude Dufour) à Saline sert une cuisine française de saison dans un jardin tropical.",
            "Les tables partent vite en saison — notre conciergerie réserve en amont pour chaque séjour, envoyez simplement vos envies depuis votre espace client.",
          ],
          places: ["bonito", "lesprit"],
        },
        {
          h: "Et bien d'autres",
          p: [
            "À deux minutes de la villa, l'adresse emblématique de Pointe Milou est réputée pour ses cocktails au coucher du soleil, sa musique live et sa cuisine méditerranéenne au-dessus de la baie — réservez le premier service et regardez le ciel faire son spectacle. Pour les déjeuners de plage pieds nus, Shellona (Shell Beach), Gyp Sea et La Guérite donnent le ton ; Nikki Beach à St Jean en est la version festive. Ouvrez la carte de l'île pour voir tous les restaurants que nous connaissons, avec les temps de route depuis la villa.",
          ],
          places: ["christo", "shellona", "gypsea", "la-guerite", "nikki-beach"],
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
      en: "Thanksgiving, the festive weeks of Christmas and New Year, mid-season, the shoulder season and summer: an honest month-by-month guide to St Barth's seasons — and when Villa ONLY VIEW books out.",
      fr: "Thanksgiving, les semaines festives de Noël et du Nouvel An, la mi-saison, l'intersaison et l'été : le guide mois par mois des saisons de St Barth — et des périodes où la Villa ONLY VIEW affiche complet.",
    },
    sections: {
      en: [
        {
          h: "Thanksgiving (late November) — the season opens",
          p: [
            "Thanksgiving week is when St Barth wakes up for winter: restaurants and boutiques have reopened, the trade winds are back, and American families fly in for a long weekend in the sun. It's a lovely, still-relaxed time to come — and the week books early, so plan ahead.",
          ],
        },
        {
          h: "Festive weeks (Christmas & New Year) — the island at its most glamorous",
          p: [
            "From just before Christmas to the first days of January, St Barth is at its busiest and most festive: superyachts fill Gustavia harbour, every table is in demand and New Year's Eve ends with fireworks over the port. At the villa, the Christmas week and the New Year week are each sold as 7-night packages and book out up to a year ahead.",
            "Coming for the holidays? Reserve restaurants early — our concierge starts booking your tables as soon as your stay is confirmed.",
          ],
        },
        {
          h: "Mid-season (February – April) — classic Caribbean winter",
          p: [
            "Dry, breezy, sunny days around 27–29°C: this is St Barth's signature weather. After the holiday rush the island finds its rhythm — perfect beach days, golden sunsets and the sailing season, with the St Barths Bucket superyacht regatta in March and Les Voiles de Saint-Barth in April.",
          ],
        },
        {
          h: "Shoulder season (May – June) — the connoisseur's pick",
          p: [
            "The island exhales: the sea is warm, the weather is still beautiful, the beaches are quiet and restaurant tables are easy to get. May and June are the insiders' favourite months — the same St Barth, at a gentler pace and softer rates.",
          ],
        },
        {
          h: "Summer (July – end of August) — warm water, long days",
          p: [
            "Hot, calm and sunny, with the warmest water of the year and the best rates. Families love it, and August is lively with the locals' village festivals. The hurricane season officially runs from June to November — travel insurance covers it, and the villa's hillside position keeps it breezy.",
            "From September to mid-November the island is at its quietest: many restaurants and shops close for their own holidays before reopening for Thanksgiving.",
          ],
        },
      ],
      fr: [
        {
          h: "Thanksgiving (fin novembre) — l'ouverture de la saison",
          p: [
            "La semaine de Thanksgiving marque le réveil de St Barth pour l'hiver : restaurants et boutiques ont rouvert, les alizés sont de retour et les familles américaines arrivent pour un long week-end au soleil. Une très belle période, encore détendue — et une semaine qui se réserve tôt, anticipez.",
          ],
        },
        {
          h: "Les semaines festives (Noël & Nouvel An) — l'île à son plus glamour",
          p: [
            "De la veille de Noël aux premiers jours de janvier, St Barth vit sa période la plus animée et la plus festive : les superyachts remplissent le port de Gustavia, chaque table est convoitée et la nuit du Nouvel An se termine par un feu d'artifice sur le port. À la villa, la semaine de Noël et celle du Nouvel An se vendent chacune en forfait de 7 nuits et se réservent jusqu'à un an à l'avance.",
            "Vous venez pour les fêtes ? Réservez vos restaurants tôt — notre conciergerie commence à réserver vos tables dès la confirmation de votre séjour.",
          ],
        },
        {
          h: "La mi-saison (février – avril) — l'hiver caribéen classique",
          p: [
            "Des journées sèches, ventilées et ensoleillées autour de 27–29 °C : c'est la météo signature de St Barth. Après le rush des fêtes, l'île trouve son rythme — journées de plage parfaites, couchers de soleil dorés et saison de la voile, avec la régate de superyachts St Barths Bucket en mars et Les Voiles de Saint-Barth en avril.",
          ],
        },
        {
          h: "L'intersaison (mai – juin) — le choix des connaisseurs",
          p: [
            "L'île respire : la mer est chaude, la météo toujours belle, les plages tranquilles et les tables faciles à obtenir. Mai et juin sont les mois préférés des habitués — le même St Barth, à un rythme plus doux et à des tarifs plus légers.",
          ],
        },
        {
          h: "L'été (juillet – fin août) — eau chaude et longues journées",
          p: [
            "Chaud, calme et ensoleillé, avec l'eau la plus chaude de l'année et les meilleurs tarifs. Les familles adorent, et août vit au rythme des fêtes de quartier de l'île. La saison cyclonique court officiellement de juin à novembre — une assurance voyage la couvre, et la position en colline de la villa la garde ventilée.",
            "De septembre à mi-novembre, l'île est à son plus calme : beaucoup de restaurants et de boutiques ferment pour leurs propres vacances avant de rouvrir pour Thanksgiving.",
          ],
        },
      ],
    },
  },
];

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
