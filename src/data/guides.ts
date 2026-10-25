/**
 * St Barth guide — evergreen content hub (SEO/GEO).
 * Written in the owners' voice; structured so AI engines and search can
 * quote clean facts (headings + short paragraphs).
 */
export interface GuideSection {
  h: string;
  p: string[];
  /** map pins (slug, or slugified name for pins added in the admin) shown
      under the section, each linking to /map#slug; unknown ones are skipped */
  places?: string[];
  /** render the Google Flights search form after this section */
  flightSearch?: boolean;
}

export interface GuideLink {
  label: { en: string; fr: string };
  url: string;
}

export interface GuideArticle {
  slug: string;
  category: string;
  title: { en: string; fr: string };
  description: { en: string; fr: string };
  /** first published / last materially revised — datePublished, dateModified, sitemap lastmod */
  published: string;
  updated: string;
  /** the <title> and meta description: shorter than the H1 and the intro,
      which engines cut at about 60 and 160 characters */
  meta: { title: { en: string; fr: string }; description: { en: string; fr: string } };
  sections: { en: GuideSection[]; fr: GuideSection[] };
  /** official sources behind the article (airlines, organisers, the tourism
      office): answer engines weigh cited pages, readers get the timetable */
  links?: GuideLink[];
}

const TOURISM_OFFICE: GuideLink = {
  label: { en: "Saint-Barthélemy Tourism Committee (official)", fr: "Comité du Tourisme de Saint-Barthélemy (officiel)" },
  url: "https://www.saintbarth-tourisme.com",
};

export const GUIDES: GuideArticle[] = [
  {
    slug: "getting-here",
    category: "practical",
    published: "2025-11-01",
    updated: "2026-10-25",
    meta: {
      title: { en: "Getting to St Barth: SXM or SJU Flights, Ferry, Transfers", fr: "Venir à St Barth : vols via SXM ou SJU, ferry, transferts" },
      description: { en: "How to reach St Barth via St Maarten (SXM) or San Juan (SJU), the short flight into SBH, the ferry, transfers, and the 10-minute drive to Villa ONLY VIEW.", fr: "Comment rejoindre St Barth via St Maarten (SXM) ou San Juan (SJU), le vol jusqu'à SBH, le ferry, les transferts et les 10 minutes de route jusqu'à la villa." },
    },
    links: [
      { label: { en: "Winair (St Maarten ↔ St Barth)", fr: "Winair (St Maarten ↔ St Barth)" }, url: "https://www.winair.sx" },
      { label: { en: "St Barth Commuter (scheduled flights and charters)", fr: "St Barth Commuter (vols réguliers et charters)" }, url: "https://www.stbarthcommuter.com" },
      { label: { en: "Tradewind Aviation (San Juan ↔ St Barth)", fr: "Tradewind Aviation (San Juan ↔ St Barth)" }, url: "https://www.flytradewind.com" },
      { label: { en: "Great Bay Express ferry (Philipsburg ↔ Gustavia)", fr: "Ferry Great Bay Express (Philipsburg ↔ Gustavia)" }, url: "https://www.greatbayexpress.com" },
      { label: { en: "Voyager ferry (Marigot ↔ Gustavia)", fr: "Ferry Voyager (Marigot ↔ Gustavia)" }, url: "https://www.voy12.com" },
      TOURISM_OFFICE,
    ],
    title: {
      en: "Getting to St Barth (and to the villa)",
      fr: "Venir à St Barth (et jusqu'à la villa)",
    },
    description: {
      en: "How to reach St Barth through St Maarten (SXM) or San Juan (SJU), the short flight into SBH, the ferry option, transfers and VIP services, and the 10-minute drive to Villa ONLY VIEW in Pointe Milou.",
      fr: "Comment rejoindre St Barth via St Maarten (SXM) ou San Juan (SJU), le petit vol jusqu'à SBH, l'option ferry, les transferts et services VIP, et les 10 minutes de route jusqu'à la Villa ONLY VIEW à Pointe Milou.",
    },
    sections: {
      en: [
        {
          h: "First, pick your gateway: SXM or SJU",
          p: [
            "There's no long-haul flight into St Barth. The runway is far too short, so everyone connects through a bigger airport nearby. You have two choices.",
            "St Maarten (SXM) is the one most of our guests use. It has direct flights from the US East Coast, Canada and Paris, and from there it's a very short hop to St Barth with Winair or St Barth Commuter.",
            "San Juan, Puerto Rico (SJU) is the other option, and often the easier one if you're coming from the US: lots of flights, US domestic arrivals, no extra passport control. From San Juan, Tradewind Aviation flies you to St Barth in about an hour.",
          ],
          flightSearch: true,
        },
        {
          h: "The last leg into St Barth (SBH)",
          p: [
            "The planes are small, so pack light and keep a swimsuit and your essentials in your hand luggage. On busy days bags sometimes follow on the next flight.",
            "The landing at Gustaf III airport is famous for a reason: the plane drops over the hill at La Tourmente and lands straight towards St Jean beach. It looks dramatic and it's perfectly routine for the pilots. The airport doesn't operate after dark, so leave yourself enough time on your connection to land before sunset.",
          ],
        },
        {
          h: "By sea from St Maarten",
          p: [
            "If the last flight has gone, or you'd simply rather take the boat, ferries (Voyager, Great Bay Express) run between St Maarten and Gustavia. The crossing takes roughly 45 minutes to an hour and a half depending on the boat and the sea, and the channel can be choppy. Check the timetables before you book your arrival flight.",
          ],
        },
        {
          h: "Transfers and VIP services",
          p: [
            "Tell us your flight details and our concierge can take care of the whole journey: a car or a driver waiting at the airport or the ferry dock, a private charter between SXM or SJU and St Barth, and VIP assistance on arrival so you skip the queues. It's all arranged from your guest portal before you leave home.",
          ],
        },
        {
          h: "From the airport to Pointe Milou",
          p: [
            "The villa is about a 10-minute drive from the airport. We'd recommend renting a small car: the roads are narrow and steep in places, parking in Gustavia is tight, and you'll want to explore. We can have the car delivered to the villa. If you'd rather not drive, the concierge books your taxis and transfers.",
            "Check-in is from 3 pm. If you land earlier, ask us through your guest portal and we'll do our best to have the house ready.",
          ],
        },
      ],
      fr: [
        {
          h: "D'abord, choisir sa porte d'entrée : SXM ou SJU",
          p: [
            "Aucun long-courrier n'atterrit à St Barth. La piste est bien trop courte, donc tout le monde passe par un aéroport voisin plus grand. Il y a deux possibilités.",
            "St Maarten (SXM) est celle que choisissent la plupart de nos hôtes. On y arrive en direct depuis Paris, la côte Est des États-Unis ou le Canada, puis un tout petit vol avec Winair ou St Barth Commuter vous dépose à St Barth.",
            "San Juan, à Porto Rico (SJU), est l'autre option, souvent la plus simple depuis les États-Unis : beaucoup de vols, et ce sont des vols intérieurs américains. Depuis San Juan, Tradewind Aviation vous emmène à St Barth en une heure environ.",
          ],
          flightSearch: true,
        },
        {
          h: "Le dernier vol jusqu'à St Barth (SBH)",
          p: [
            "Les avions sont petits : voyagez léger et gardez un maillot et l'essentiel en cabine. Les jours chargés, il arrive que les bagages suivent sur le vol d'après.",
            "L'atterrissage à l'aéroport Gustaf III est célèbre, à juste titre : l'avion passe au ras de la colline de la Tourmente et se pose face à la plage de St Jean. Impressionnant, mais parfaitement habituel pour les pilotes. L'aéroport ne fonctionne pas de nuit, prévoyez donc une correspondance qui vous fait atterrir avant le coucher du soleil.",
          ],
        },
        {
          h: "Par la mer depuis St Maarten",
          p: [
            "Si le dernier vol est parti, ou si vous préférez le bateau, des ferries (Voyager, Great Bay Express) relient St Maarten à Gustavia. Comptez entre 45 minutes et une heure et demie selon le bateau et la mer, qui peut être agitée dans le canal. Vérifiez les horaires avant de réserver votre vol d'arrivée.",
          ],
        },
        {
          h: "Transferts et services VIP",
          p: [
            "Donnez-nous vos horaires et notre conciergerie s'occupe de tout le trajet : voiture ou chauffeur qui vous attend à l'aéroport ou au quai du ferry, vol charter privé entre SXM ou SJU et St Barth, assistance VIP à l'arrivée pour éviter l'attente. Tout s'organise depuis votre espace client, avant même votre départ.",
          ],
        },
        {
          h: "De l'aéroport à Pointe Milou",
          p: [
            "La villa est à une dizaine de minutes de route de l'aéroport. Nous conseillons de louer une petite voiture : les routes sont étroites et parfois très pentues, on se gare difficilement à Gustavia, et vous aurez envie de bouger. Nous pouvons la faire livrer à la villa. Si vous préférez ne pas conduire, la conciergerie réserve vos taxis et transferts.",
            "L'arrivée se fait à partir de 15 h. Si vous atterrissez plus tôt, demandez-nous via votre espace client et nous ferons notre possible pour que la maison soit prête.",
          ],
        },
      ],
    },
  },
  {
    slug: "best-beaches",
    category: "island",
    published: "2025-11-01",
    updated: "2026-10-25",
    meta: {
      title: { en: "The Best Beaches of St Barth, from Pointe Milou", fr: "Les plus belles plages de St Barth, depuis Pointe Milou" },
      description: { en: "Our favourite St Barth beaches and the drive time from Villa ONLY VIEW: Lorient, St Jean, Grand Cul-de-Sac, Gouverneur, Saline, Toiny, Colombier, Flamands.", fr: "Nos plages préférées à St Barth et le temps de route depuis la Villa ONLY VIEW : Lorient, St Jean, Grand Cul-de-Sac, Gouverneur, Saline, Toiny, Colombier." },
    },
    links: [TOURISM_OFFICE],
    title: {
      en: "The best beaches of St Barth, from Pointe Milou",
      fr: "Plages de St Barth, vues de Pointe Milou",
    },
    description: {
      en: "Our favourite beaches in St Barth and how long it takes to reach them from Villa ONLY VIEW: Lorient, St Jean, Grand Cul-de-Sac, Gouverneur, Saline, Toiny, Colombier, Flamands and Shell Beach.",
      fr: "Nos plages préférées à St Barth et le temps pour les rejoindre depuis la Villa ONLY VIEW : Lorient, St Jean, Grand Cul-de-Sac, Gouverneur, Saline, Toiny, Colombier, Flamands et Shell Beach.",
    },
    sections: {
      en: [
        {
          h: "Good to know before you go",
          p: [
            "All beaches in St Barth are public, including the ones in front of the big hotels. Some have restaurants and sunbeds, others have nothing at all, so for Gouverneur, Saline or Colombier bring water, snacks and something for shade. The island is small: nothing is more than about 20 minutes from the villa.",
          ],
        },
        {
          h: "Close to the villa: Lorient and St Jean",
          p: [
            "Lorient, 5 minutes away, is our everyday beach. It's calm in the morning, popular with surfers at the far end, and the Oasis supermarket is right there if you want to pick up a picnic.",
            "St Jean, 8 minutes away, is the busy one, and in a good way. The rock of Eden Rock splits the bay in two, the water is shallow and clear, and there are beach clubs (Nikki Beach is here), shops and planes coming in over your head.",
          ],
          places: ["lorient-beach", "st-jean-beach-restaurants-side"],
        },
        {
          h: "Grand Cul-de-Sac, the lagoon",
          p: [
            "Seven minutes from the villa, Grand Cul-de-Sac is a shallow lagoon protected by the reef. It's the place for kitesurfing, paddleboarding and kayaking, and you'll often see turtles feeding near the shore. It's also where you'll find Ti'Corail, one of our favourite lunches on the island.",
          ],
          places: ["grand-cul-de-sac", "ti-corail"],
        },
        {
          h: "The wild south: Gouverneur and Saline",
          p: [
            "These are the two beaches people come back from talking about. No buildings, no beach clubs, just a long stretch of pale sand and very blue water.",
            "Gouverneur is reached by a steep road down the hill, and the view on the way is worth stopping for. At Saline you park and walk a couple of minutes over a sand dune, which keeps it quieter. Both are lovely in the late afternoon when the light softens.",
          ],
          places: ["gouverneur-beach", "saline-beach"],
        },
        {
          h: "Toiny and the Le Toiny beach club",
          p: [
            "Toiny, on the Atlantic side, is a different St Barth: rocky, windy, with big waves rolling in and hardly anyone around. It's beautiful for a walk along the coast or for photos, but the sea is rough, so it's not a swimming beach.",
            "Below the cliffs, the Hotel Le Toiny has its own beach club, and it's one of the nicest lunches on the island. You eat in the shade by the sand, there's a pool, and the menu is mostly grilled fish and fresh salads. Reservations are essential, and our concierge can make one for you.",
          ],
          places: ["toiny-beach", "le-toiny-beach-club"],
        },
        {
          h: "Worth the trip: Colombier, Flamands and Shell Beach",
          p: [
            "Colombier, at the far north-west, has no road. You get there by boat or by a walking trail of about half an hour from the end of Flamands, and the bay at the end is the most secluded on the island. Go in the morning before it gets hot.",
            "Flamands is a wide, long beach on the north coast, good for a long swim. Shell Beach in Gustavia is, as the name says, made of tiny shells. You can walk there from the harbour, and it's a nice place to finish the day at sunset.",
          ],
          places: ["anse-de-colombier", "flamands-beach", "shell-beach"],
        },
      ],
      fr: [
        {
          h: "À savoir avant d'y aller",
          p: [
            "Toutes les plages de St Barth sont publiques, y compris celles devant les grands hôtels. Certaines ont restaurants et transats, d'autres rien du tout : pour Gouverneur, Saline ou Colombier, prévoyez de l'eau, de quoi grignoter et un peu d'ombre. L'île est petite, aucune plage n'est à plus d'une vingtaine de minutes de la villa.",
          ],
        },
        {
          h: "Tout près de la villa : Lorient et St Jean",
          p: [
            "Lorient, à 5 minutes, c'est notre plage du quotidien. Calme le matin, fréquentée par les surfeurs au bout, et le supermarché Oasis juste à côté si vous voulez préparer un pique-nique.",
            "St Jean, à 8 minutes, est la plus animée, dans le bon sens du terme. Le rocher de l'Eden Rock coupe la baie en deux, l'eau est peu profonde et claire, et on y trouve des beach clubs (dont Nikki Beach), des boutiques et les avions qui passent juste au-dessus.",
          ],
          places: ["lorient-beach", "st-jean-beach-restaurants-side"],
        },
        {
          h: "Grand Cul-de-Sac, le lagon",
          p: [
            "À 7 minutes de la villa, Grand Cul-de-Sac est un lagon peu profond protégé par la barrière de corail. C'est l'endroit pour le kitesurf, le paddle et le kayak, et on y voit souvent des tortues près du bord. C'est aussi là que se trouve Ti'Corail, l'un de nos déjeuners préférés de l'île.",
          ],
          places: ["grand-cul-de-sac", "ti-corail"],
        },
        {
          h: "Le sud sauvage : Gouverneur et Saline",
          p: [
            "Ce sont les deux plages dont on revient en parlant encore. Aucune construction, aucun beach club, juste une longue bande de sable clair et une eau très bleue.",
            "On descend à Gouverneur par une route raide, et la vue en chemin mérite un arrêt. À Saline, on se gare et on marche deux minutes par-dessus une dune, ce qui la garde plus tranquille. Les deux sont superbes en fin d'après-midi, quand la lumière s'adoucit.",
          ],
          places: ["gouverneur-beach", "saline-beach"],
        },
        {
          h: "Toiny et le beach club du Toiny",
          p: [
            "Toiny, côté Atlantique, c'est un autre St Barth : des rochers, du vent, de grosses vagues et presque personne. Magnifique pour marcher le long de la côte ou faire des photos, mais la mer y est forte, ce n'est pas une plage de baignade.",
            "En contrebas des falaises, l'Hôtel Le Toiny a son propre beach club, et c'est l'un des plus beaux déjeuners de l'île. On mange à l'ombre au bord du sable, il y a une piscine, et la carte fait la part belle au poisson grillé et aux salades. Réservation indispensable, notre conciergerie peut s'en charger.",
          ],
          places: ["toiny-beach", "le-toiny-beach-club"],
        },
        {
          h: "Valent le déplacement : Colombier, Flamands et Shell Beach",
          p: [
            "Colombier, tout au nord-ouest, n'a pas de route. On y va en bateau ou par un sentier d'une demi-heure environ depuis le bout de Flamands, et la baie qui vous attend est la plus isolée de l'île. Allez-y le matin, avant la chaleur.",
            "Flamands est une grande plage sur la côte nord, idéale pour nager longtemps. Shell Beach, à Gustavia, est faite de minuscules coquillages, comme son nom l'indique. On y va à pied depuis le port, et c'est un bel endroit pour finir la journée au coucher du soleil.",
          ],
          places: ["anse-de-colombier", "flamands-beach", "shell-beach"],
        },
      ],
    },
  },
  {
    slug: "best-restaurants",
    category: "island",
    published: "2025-11-01",
    updated: "2026-10-25",
    meta: {
      title: { en: "Where to Eat in St Barth: Our Top Restaurant Picks", fr: "Où manger à St Barth : nos restaurants coups de cœur" },
      description: { en: "The St Barth restaurants we recommend to friends: Ti'Corail, La Cantina, Le Repaire, Barry Rooftop, L'Isola, L'Isoletta, Bonito, L'Esprit, plus booking tips.", fr: "Les restaurants de St Barth que nous conseillons à nos amis : Ti'Corail, La Cantina, Le Repaire, Barry Rooftop, L'Isola, L'Isoletta, Bonito, L'Esprit." },
    },
    title: {
      en: "Where to eat in St Barth: our top picks",
      fr: "Où manger à St Barth : nos coups de cœur",
    },
    description: {
      en: "The St Barth restaurants we recommend to our own friends: Ti'Corail, La Cantina, Le Repaire, Barry Rooftop, L'Isola, L'Isoletta, Bonito and L'Esprit, plus beach clubs and tips for booking in season.",
      fr: "Les restaurants de St Barth que nous recommandons à nos propres amis : Ti'Corail, La Cantina, Le Repaire, Barry Rooftop, L'Isola, L'Isoletta, Bonito et L'Esprit, plus les beach clubs et nos conseils pour réserver en saison.",
    },
    sections: {
      en: [
        {
          h: "Before we start",
          p: [
            "For such a small island, St Barth eats remarkably well, and honestly, it's hard to have a bad meal here. Every restaurant has its own style and its regulars. What follows are simply the places we keep going back to and the ones we send our friends to. Use it as a starting point, then try whatever catches your eye.",
          ],
        },
        {
          h: "Lunch",
          p: [
            "If you only do one lunch, make it Ti'Corail. It's a tiny place right on the beach at Grand Cul-de-Sac, open for lunch only, with a short menu that changes every day depending on what came in from the sea. There are only a few tables, so book ahead.",
            "In Gustavia, La Cantina is our go-to for something quick and easy. It sits on the harbour, so you get the boats and the view with your lunch. If you're in the mood for a proper French brasserie, Le Repaire, also on the harbour, is open all day from breakfast onwards.",
            "And for a long lunch with your feet in the sand, the beach club at the Hotel Le Toiny is hard to beat (more on that in our beaches guide).",
          ],
          places: ["ti-corail", "la-cantina", "le-repaire", "le-toiny-beach-club"],
        },
        {
          h: "Sushi",
          p: [
            "For sushi, go to Barry Rooftop. It's up above Gustavia harbour, open in the evening, and the menu mixes Japanese and Peruvian: sushi, ceviche, tiradito. Come early for the view while it's still light.",
          ],
          places: ["barry"],
        },
        {
          h: "Italian and pizza",
          p: [
            "L'Isola in Gustavia is our Italian. The pasta is made in-house and the cooking is the real thing, without fuss. For pizza, head to L'Isoletta, its little sister a few steps away, which is more casual and perfect with kids or after a day at the beach.",
          ],
          places: ["lisola", "lisoletta"],
        },
        {
          h: "A special dinner",
          p: [
            "When you want to dress up a little, book Bonito. It looks over Gustavia harbour, and the kitchen is French with a lot of South American influence, so expect ceviches and bold flavours.",
            "For a really good French dinner, L'Esprit at Saline is our pick. Chef Jean-Claude Dufour cooks seasonal French food, and you eat in a tropical garden. It's quieter than Gustavia and feels like a proper night out.",
          ],
          places: ["bonito", "lesprit"],
        },
        {
          h: "Plenty more to discover",
          p: [
            "Right next door to the villa, the beach club at Hotel Le Christopher in Pointe Milou is lovely for a sunset drink. On St Jean and Shell Beach, Gyp Sea, La Guérite, Shellona and Nikki Beach each have their own crowd, from relaxed to very lively. The island map shows every restaurant we know, with the drive time from the villa.",
          ],
          places: ["christo", "shellona", "gypsea", "la-guerite", "nikki-beach"],
        },
        {
          h: "Booking tips",
          p: [
            "From Christmas to April, the popular tables fill up days or even weeks in advance, so it's worth booking your must-dos before you arrive. Send us your wishlist through your guest portal and our concierge will handle the reservations. Also note that in September and October many restaurants close for their own holidays.",
          ],
        },
      ],
      fr: [
        {
          h: "Avant de commencer",
          p: [
            "Pour une si petite île, on mange remarquablement bien à St Barth, et honnêtement il est difficile d'y faire un mauvais repas. Chaque restaurant a son style et ses habitués. Ce qui suit, ce sont simplement les adresses où nous retournons sans cesse et celles que nous conseillons à nos amis. Prenez-les comme un point de départ, puis laissez-vous tenter par le reste.",
          ],
        },
        {
          h: "Le déjeuner",
          p: [
            "Si vous ne devez faire qu'un déjeuner, que ce soit Ti'Corail. C'est une toute petite adresse les pieds dans le sable à Grand Cul-de-Sac, ouverte uniquement le midi, avec une courte carte qui change chaque jour selon la pêche. Il n'y a que quelques tables, pensez à réserver.",
            "À Gustavia, La Cantina est notre adresse pour un déjeuner simple et rapide. Elle donne sur le port, on profite des bateaux et de la vue. Si vous avez envie d'une vraie brasserie française, Le Repaire, sur le port lui aussi, est ouvert toute la journée dès le petit-déjeuner.",
            "Et pour un long déjeuner les pieds dans le sable, le beach club de l'Hôtel Le Toiny est difficile à battre (on en parle dans notre guide des plages).",
          ],
          places: ["ti-corail", "la-cantina", "le-repaire", "le-toiny-beach-club"],
        },
        {
          h: "Sushi",
          p: [
            "Pour les sushis, c'est Barry Rooftop. Il domine le port de Gustavia, ouvre le soir, et la carte mélange Japon et Pérou : sushis, ceviche, tiradito. Venez tôt pour profiter de la vue avant la nuit.",
          ],
          places: ["barry"],
        },
        {
          h: "Italien et pizza",
          p: [
            "L'Isola, à Gustavia, est notre italien. Les pâtes sont faites maison et la cuisine est authentique, sans chichis. Pour une pizza, allez chez L'Isoletta, sa petite sœur à quelques pas, plus décontractée et parfaite avec des enfants ou après la plage.",
          ],
          places: ["lisola", "lisoletta"],
        },
        {
          h: "Un dîner d'exception",
          p: [
            "Quand vous avez envie de vous habiller un peu, réservez chez Bonito. Le restaurant domine le port de Gustavia, et la cuisine est française avec beaucoup d'influences sud-américaines : ceviches et saveurs franches.",
            "Pour un très bon dîner français, notre choix est L'Esprit, à Saline. Le chef Jean-Claude Dufour y cuisine des produits de saison, et l'on dîne dans un jardin tropical. Plus calme que Gustavia, c'est une vraie belle soirée.",
          ],
          places: ["bonito", "lesprit"],
        },
        {
          h: "Bien d'autres adresses à découvrir",
          p: [
            "Juste à côté de la villa, le beach club de l'Hôtel Le Christopher à Pointe Milou est parfait pour un verre au coucher du soleil. À St Jean et sur Shell Beach, Gyp Sea, La Guérite, Shellona et Nikki Beach ont chacun leur ambiance, de la plus détendue à la plus festive. La carte de l'île recense tous les restaurants que nous connaissons, avec le temps de route depuis la villa.",
          ],
          places: ["christo", "shellona", "gypsea", "la-guerite", "nikki-beach"],
        },
        {
          h: "Nos conseils pour réserver",
          p: [
            "De Noël à avril, les tables les plus prisées se remplissent plusieurs jours, voire plusieurs semaines à l'avance : réservez vos incontournables avant d'arriver. Envoyez-nous vos envies depuis votre espace client et notre conciergerie s'occupe des réservations. À noter aussi : en septembre et octobre, beaucoup de restaurants ferment pour leurs propres vacances.",
          ],
        },
      ],
    },
  },
  {
    slug: "seasons",
    category: "practical",
    published: "2025-11-01",
    updated: "2026-10-25",
    meta: {
      title: { en: "St Barth Seasons: When to Come, Month by Month", fr: "Les saisons de St Barth : quand venir, mois par mois" },
      description: { en: "When to visit St Barth, season by season: Thanksgiving, Christmas and New Year, February to April, the May–June shoulder season, summer, and the quiet autumn.", fr: "Quand venir à St Barth, saison par saison : Thanksgiving, Noël et Nouvel An, février à avril, l'intersaison de mai-juin, l'été et l'automne calme." },
    },
    links: [TOURISM_OFFICE],
    title: {
      en: "St Barth seasons: when to come",
      fr: "Les saisons de St Barth : quand venir",
    },
    description: {
      en: "When to visit St Barth, season by season: Thanksgiving, Christmas and New Year, mid-season from February to April, the shoulder season in May and June, and summer in July and August.",
      fr: "Quand venir à St Barth, saison par saison : Thanksgiving, Noël et le Nouvel An, la mi-saison de février à avril, l'intersaison en mai et juin, et l'été en juillet et août.",
    },
    sections: {
      en: [
        {
          h: "The short answer",
          p: [
            "There's no bad time to come, just different moods. The weather is warm all year. What changes is the wind, the rain, how busy the island is and the rates. Here is how the year goes, from the start of the season in November.",
          ],
        },
        {
          h: "Thanksgiving (late November)",
          p: [
            "Thanksgiving week is when the island properly reopens after the quiet autumn. Restaurants and shops are back, the trade winds return, and a lot of American families come for the long weekend. It's a lovely time: the season has started but it's still relaxed. The week is popular, so book early.",
          ],
        },
        {
          h: "Christmas and New Year (the festive weeks)",
          p: [
            "This is St Barth at its busiest and most glamorous. The big yachts fill Gustavia harbour, the island is full of energy, and New Year's Eve ends with fireworks over the port.",
            "At the villa, the Christmas week and the New Year week are each rented as a 7-night package and often book a year ahead. If you're coming for the holidays, plan restaurants early too. Our concierge starts booking your tables as soon as your stay is confirmed.",
          ],
        },
        {
          h: "Mid-season (February to April)",
          p: [
            "The classic Caribbean winter: dry, sunny, with a steady breeze and days around 27 to 29°C. After the holiday rush the island settles into a nice rhythm. It's also sailing season, with the St Barths Bucket superyacht regatta in March and Les Voiles de Saint-Barth in April, both great to watch from the shore.",
          ],
        },
        {
          h: "Shoulder season (May and June)",
          p: [
            "A lot of regulars will tell you this is the best time of year. The sea is warmer, the weather is still beautiful, the beaches are quiet and you can get a table almost anywhere without planning. You get the same St Barth at a slower pace, with softer rates.",
          ],
        },
        {
          h: "Summer (July to the end of August)",
          p: [
            "Hot, calm and sunny, with the warmest water of the year and our best rates. It's a great time for families. August is when the island celebrates: each village has its fête, and the island's own day, the Saint-Barthélemy, is on 24 August.",
            "Summer is also the start of hurricane season, which officially runs from June to November. Most summers pass without any trouble, but we recommend travel insurance. The villa sits on the hillside and stays nicely ventilated.",
          ],
        },
        {
          h: "September to mid-November",
          p: [
            "This is the island's quiet time. Many restaurants, shops and some hotels close for a few weeks so their teams can take their own holidays, then everything reopens in time for Thanksgiving.",
          ],
        },
      ],
      fr: [
        {
          h: "En résumé",
          p: [
            "Il n'y a pas de mauvaise période, seulement des ambiances différentes. Il fait chaud toute l'année. Ce qui change, c'est le vent, la pluie, l'affluence et les tarifs. Voici comment se déroule l'année, à partir de l'ouverture de la saison en novembre.",
          ],
        },
        {
          h: "Thanksgiving (fin novembre)",
          p: [
            "La semaine de Thanksgiving, c'est le vrai retour de l'île après le calme de l'automne. Restaurants et boutiques rouvrent, les alizés reviennent, et beaucoup de familles américaines viennent pour le long week-end. Une très belle période : la saison a commencé mais tout reste détendu. La semaine est demandée, réservez tôt.",
          ],
        },
        {
          h: "Noël et le Nouvel An (les semaines festives)",
          p: [
            "C'est St Barth dans sa période la plus animée et la plus glamour. Les grands yachts remplissent le port de Gustavia, l'île déborde d'énergie, et la nuit du Nouvel An se termine par un feu d'artifice sur le port.",
            "À la villa, la semaine de Noël et celle du Nouvel An se louent chacune en forfait de 7 nuits et se réservent souvent un an à l'avance. Si vous venez pour les fêtes, pensez aussi aux restaurants : notre conciergerie commence à réserver vos tables dès la confirmation de votre séjour.",
          ],
        },
        {
          h: "La mi-saison (février à avril)",
          p: [
            "L'hiver caribéen classique : sec, ensoleillé, avec une brise régulière et des journées autour de 27 à 29 °C. Après le rush des fêtes, l'île retrouve un rythme agréable. C'est aussi la saison de la voile, avec la régate de superyachts St Barths Bucket en mars et Les Voiles de Saint-Barth en avril, deux beaux spectacles depuis la côte.",
          ],
        },
        {
          h: "L'intersaison (mai et juin)",
          p: [
            "Beaucoup d'habitués vous diront que c'est la meilleure période. La mer est plus chaude, la météo toujours belle, les plages tranquilles, et on trouve une table presque partout sans s'organiser. Le même St Barth, à un rythme plus lent et à des tarifs plus doux.",
          ],
        },
        {
          h: "L'été (juillet à fin août)",
          p: [
            "Chaud, calme et ensoleillé, avec l'eau la plus chaude de l'année et nos meilleurs tarifs. Une très bonne période pour les familles. Août est le mois des fêtes : chaque quartier a la sienne, et la fête de l'île, la Saint-Barthélemy, tombe le 24 août.",
            "L'été marque aussi le début de la saison cyclonique, qui court officiellement de juin à novembre. La plupart des étés se passent sans souci, mais nous conseillons une assurance voyage. La villa, à flanc de colline, reste bien ventilée.",
          ],
        },
        {
          h: "De septembre à mi-novembre",
          p: [
            "C'est la période calme de l'île. Beaucoup de restaurants, de boutiques et certains hôtels ferment quelques semaines pour que leurs équipes partent à leur tour en vacances, puis tout rouvre à temps pour Thanksgiving.",
          ],
        },
      ],
    },
  },
  {
    slug: "practical-info",
    category: "practical",
    published: "2026-10-25",
    updated: "2026-10-25",
    meta: {
      title: { en: "St Barth Practical Guide: Money, Driving, Power, Health", fr: "St Barth pratique : argent, voiture, électricité, santé" },
      description: { en: "The practical side of St Barth from villa owners: entry rules, euros and dollars, tipping, renting a car, plugs and voltage, tap water, pharmacies, Sundays.", fr: "Le côté pratique de St Barth par des propriétaires : formalités, euros et dollars, pourboires, voiture, prises et voltage, eau du robinet, pharmacies." },
    },
    links: [
      TOURISM_OFFICE,
      { label: { en: "France-Visas (entry requirements for France and Saint-Barthélemy)", fr: "France-Visas (conditions d'entrée en France et à Saint-Barthélemy)" }, url: "https://france-visas.gouv.fr" },
    ],
    title: {
      en: "St Barth practical guide: money, language, driving, power, water, health",
      fr: "St Barth pratique : argent, langue, voiture, électricité, eau, santé",
    },
    description: {
      en: "The practical side of a St Barth holiday, from villa owners: entry rules, euros and dollars, tipping, renting a car, plugs and voltage, tap water, pharmacies and the hospital, Sundays, and what to pack.",
      fr: "Le côté pratique d'un séjour à St Barth, par des propriétaires de villa : formalités d'entrée, euros et dollars, pourboires, voiture de location, prises et voltage, eau du robinet, pharmacies et hôpital, dimanches, et quoi emporter.",
    },
    sections: {
      en: [
        {
          h: "Before you fly",
          p: [
            "St Barth is France, so the entry rules are France's. EU citizens travel with an identity card; visitors from the United States, Canada and the United Kingdom need a passport and no visa for stays under 90 days. If you do need a visa for France, make sure it explicitly covers Saint-Barthélemy, which sits outside the Schengen area. Rules change, so check the official France-Visas site before you book.",
            "Travel insurance is a good idea in any season and essential between June and November, when a storm can disrupt flights. Pack light: the planes into St Barth are small, bags occasionally follow on the next flight, and nobody dresses up here anyway. A swimsuit and your medicines go in the hand luggage.",
            "Bring a plug adapter if your devices are American or British, reef-safe sunscreen, and insect repellent for the evenings after rain.",
          ],
        },
        {
          h: "Money",
          p: [
            "The currency is the euro. US dollars are accepted in most restaurants and shops, usually at a round rate that is not in your favour, so paying in euros or by card is simpler. Visa and Mastercard work everywhere, American Express less often. Keep some cash for the bakery and for taxis.",
            "There is no VAT in St Barth, which is why the watches, jewellery and fashion in Gustavia cost less than in Paris, and why the shopping bags on the ferry are so big.",
          ],
        },
        {
          h: "Language and manners",
          p: [
            "French is the language, and English is spoken in every restaurant, shop and hotel. Say bonjour when you walk in, the way you would in France; it changes the welcome.",
            "Service is included in restaurant bills, as everywhere in France. Rounding up or leaving 5 to 10% after a good meal is appreciated but not expected. Taxi drivers and the housekeeping team are happy with a tip, and nobody will be offended without one.",
          ],
        },
        {
          h: "Driving and getting around",
          p: [
            "Rent a small car. The island has one main road and a lot of steep, narrow lanes; a Mini Moke or a small SUV is easier to park than anything bigger, and parking in Gustavia at dinner time takes patience. You drive on the right, and your home driving licence is fine for a holiday.",
            "Taxis exist but are few and do not cruise: book them ahead for dinner returns, or ask us, we have the drivers' numbers. There is no ride-hailing app. Gas stations close on Sundays, so fill up on Saturday.",
            "We can have a rental car waiting at the villa for your arrival. Tell us your flight and the size of car you like.",
          ],
          places: ["gas-station-lorient", "gas-station-st-jean"],
        },
        {
          h: "Time, power, water, phone",
          p: [
            "St Barth is on UTC−4 all year, with no daylight saving. That is one hour ahead of New York in winter and the same time in summer; Paris is five hours ahead in winter, six in summer.",
            "Electricity is 220–230 volts with European two-pin plugs (types C and E). American devices need an adapter and, for hairdryers and the like, dual voltage.",
            "Tap water comes from the island's desalination plant and is safe to drink; many people prefer bottled water for the taste. The villa has 5 Gbps fibre Wi-Fi, faster than most offices.",
            "Phone numbers are French (+590). Your operator's roaming rules apply, so check them before you land, or simply use the villa's Wi-Fi.",
          ],
        },
        {
          h: "Shopping and food",
          p: [
            "The supermarkets are in Lorient (5 minutes from the villa), St Jean and Gustavia, and the bakeries open early. Many shops close at lunchtime, on Sunday afternoons and on French public holidays; the villa's housekeeping doesn't run on Sundays and holidays either.",
            "If you want the fridge full when you land, tell us before you arrive and we will point you to the right shops. Our concierge can also arrange a private chef for one evening or for the whole week.",
          ],
          places: ["u-express-lorient", "monoprix-st-jean", "super-u"],
        },
        {
          h: "Health and safety",
          p: [
            "St Barth has a hospital in Gustavia (Hôpital de Bruyn) for emergencies, doctors in town, and pharmacies in Gustavia and St Jean. The emergency numbers are 15 (medical) and 112.",
            "The sun is strong all year, the sea can have currents on the Atlantic side and at Saline and Gouverneur after a swell, and mosquitoes come out at dusk. Our pool is not fenced, so small children need an adult nearby, as everywhere on the island.",
          ],
          places: ["pharmacie-de-gustavia", "pharmacie-de-st-jean"],
        },
        {
          h: "What nobody tells you",
          p: [
            "The airport closes at sunset, so a late connection in St Maarten means a night there or the ferry. Restaurants book up weeks ahead between Christmas and March; send us your wishlist and we will reserve. September and October are the quiet months, when many places close for their own holidays. And bring less than you think: you will live in a swimsuit.",
          ],
        },
      ],
      fr: [
        {
          h: "Avant de partir",
          p: [
            "St Barth, c'est la France : les formalités d'entrée sont celles de la France. Les citoyens de l'UE voyagent avec une carte d'identité ; les visiteurs des États-Unis, du Canada et du Royaume-Uni ont besoin d'un passeport et d'aucun visa pour moins de 90 jours. Si vous avez besoin d'un visa pour la France, vérifiez qu'il couvre bien Saint-Barthélemy, qui est hors espace Schengen. Les règles changent : consultez le site officiel France-Visas avant de réserver.",
            "Une assurance voyage est une bonne idée en toute saison et indispensable de juin à novembre, quand une tempête peut perturber les vols. Voyagez léger : les avions vers St Barth sont petits, les bagages suivent parfois sur le vol d'après, et personne ne s'habille ici de toute façon. Un maillot et vos médicaments vont en cabine.",
            "Prévoyez un adaptateur si vos appareils sont américains ou britanniques, une crème solaire respectueuse des coraux, et un anti-moustiques pour les soirées après la pluie.",
          ],
        },
        {
          h: "L'argent",
          p: [
            "La monnaie est l'euro. Les dollars américains sont acceptés dans la plupart des restaurants et des boutiques, souvent à un taux arrondi qui n'est pas en votre faveur : payer en euros ou par carte est plus simple. Visa et Mastercard passent partout, American Express moins souvent. Gardez un peu de liquide pour la boulangerie et les taxis.",
            "Il n'y a pas de TVA à St Barth : c'est pour cela que les montres, les bijoux et la mode coûtent moins cher à Gustavia qu'à Paris, et que les sacs sont si gros sur le ferry du retour.",
          ],
        },
        {
          h: "La langue et les usages",
          p: [
            "On parle français, et l'anglais est compris dans tous les restaurants, boutiques et hôtels. Dites bonjour en entrant, comme en France : cela change l'accueil.",
            "Le service est compris dans l'addition, comme partout en France. Arrondir ou laisser 5 à 10 % après un bon repas fait plaisir mais n'est pas attendu. Les chauffeurs de taxi et l'équipe de ménage apprécient un pourboire, et personne ne se vexera sans.",
          ],
        },
        {
          h: "Conduire et se déplacer",
          p: [
            "Louez une petite voiture. L'île a une route principale et beaucoup de petites routes raides et étroites ; une Mini Moke ou un petit SUV se gare plus facilement que n'importe quoi de plus grand, et se garer à Gustavia à l'heure du dîner demande de la patience. On roule à droite, et votre permis habituel suffit pour des vacances.",
            "Il y a des taxis, mais peu, et ils ne circulent pas à vide : réservez-les à l'avance pour les retours de dîner, ou demandez-nous, nous avons les numéros des chauffeurs. Il n'y a pas d'application de VTC. Les stations-service ferment le dimanche : faites le plein le samedi.",
            "Nous pouvons faire livrer une voiture de location à la villa pour votre arrivée. Indiquez-nous votre vol et la taille de voiture qui vous convient.",
          ],
          places: ["gas-station-lorient", "gas-station-st-jean"],
        },
        {
          h: "Heure, électricité, eau, téléphone",
          p: [
            "St Barth est à UTC−4 toute l'année, sans changement d'heure. Cela fait 5 heures de moins que Paris en hiver et 6 en été ; une heure de plus que New York en hiver, la même heure en été.",
            "L'électricité est en 220–230 volts avec des prises européennes (types C et E). Les appareils américains ont besoin d'un adaptateur et, pour les sèche-cheveux et autres, d'un double voltage.",
            "L'eau du robinet vient de l'usine de dessalement de l'île et se boit sans risque ; beaucoup préfèrent l'eau en bouteille pour le goût. La villa a la fibre à 5 Gbps, plus rapide que la plupart des bureaux.",
            "Les numéros de téléphone sont français (+590). Les règles d'itinérance de votre opérateur s'appliquent : vérifiez-les avant d'atterrir, ou utilisez simplement le Wi-Fi de la villa.",
          ],
        },
        {
          h: "Courses et cuisine",
          p: [
            "Les supermarchés sont à Lorient (5 minutes de la villa), à St Jean et à Gustavia, et les boulangeries ouvrent tôt. Beaucoup de commerces ferment à l'heure du déjeuner, le dimanche après-midi et les jours fériés ; le ménage de la villa ne se fait pas non plus les dimanches et jours fériés.",
            "Si vous voulez trouver le frigo plein en arrivant, dites-le-nous avant votre départ et nous vous indiquerons les bonnes adresses. Notre conciergerie peut aussi organiser un chef à domicile pour un soir ou pour toute la semaine.",
          ],
          places: ["u-express-lorient", "monoprix-st-jean", "super-u"],
        },
        {
          h: "Santé et sécurité",
          p: [
            "St Barth a un hôpital à Gustavia (l'hôpital de Bruyn) pour les urgences, des médecins en ville, et des pharmacies à Gustavia et à St Jean. Les numéros d'urgence sont le 15 (SAMU) et le 112.",
            "Le soleil est fort toute l'année, la mer peut avoir des courants côté Atlantique et à Saline ou Gouverneur après une houle, et les moustiques sortent à la tombée du jour. Notre piscine n'est pas clôturée : les petits ont besoin d'un adulte à côté, comme partout sur l'île.",
          ],
          places: ["pharmacie-de-gustavia", "pharmacie-de-st-jean"],
        },
        {
          h: "Ce que personne ne vous dit",
          p: [
            "L'aéroport ferme au coucher du soleil : une correspondance tardive à St Maarten, c'est une nuit sur place ou le ferry. Les restaurants se réservent des semaines à l'avance entre Noël et mars ; envoyez-nous vos envies et nous réservons. Septembre et octobre sont les mois calmes, quand beaucoup d'adresses ferment pour leurs propres vacances. Et emportez moins que prévu : vous vivrez en maillot.",
          ],
        },
      ],
    },
  },
  {
    slug: "events",
    category: "island",
    published: "2026-10-25",
    updated: "2026-10-25",
    meta: {
      title: { en: "St Barth Events & Festivals, Month by Month", fr: "Les événements de St Barth, mois par mois" },
      description: { en: "St Barth through the year: the Music Festival in January, Carnival, the Bucket regatta in March, Les Voiles in April, summer fêtes, the Gourmet Festival in November.", fr: "St Barth au fil de l'année : le Music Festival en janvier, le Carnaval, la Bucket en mars, Les Voiles en avril, les fêtes de l'été, le Gourmet Festival en novembre." },
    },
    links: [
      TOURISM_OFFICE,
      { label: { en: "St Barths Bucket Regatta (March)", fr: "St Barths Bucket Regatta (mars)" }, url: "https://www.bucketregatta.com" },
      { label: { en: "Saint-Barth Gourmet Festival (November)", fr: "Saint-Barth Gourmet Festival (novembre)" }, url: "https://www.saintbarthgourmetfestival.com" },
      { label: { en: "St Barth Cata Cup (November)", fr: "St Barth Cata Cup (novembre)" }, url: "https://www.stbarthcatacup.com" },
    ],
    title: {
      en: "St Barth events and festivals, month by month",
      fr: "Les événements de St Barth, mois par mois",
    },
    description: {
      en: "What happens in St Barth through the year: the Music Festival in January, Carnival, the Bucket superyacht regatta in March, Les Voiles de Saint-Barth in April, the summer village fêtes, the Gourmet Festival and the Cata Cup in November, New Year's Eve in Gustavia.",
      fr: "Ce qui se passe à St Barth au fil de l'année : le Music Festival en janvier, le Carnaval, la régate de superyachts Bucket en mars, Les Voiles de Saint-Barth en avril, les fêtes des villages l'été, le Gourmet Festival et la Cata Cup en novembre, le Nouvel An à Gustavia.",
    },
    sections: {
      en: [
        {
          h: "Why it matters when you book",
          p: [
            "A few weeks each year the island fills up, the restaurants book out and the harbour turns into a show. They are wonderful to see, and worth knowing about, either to be here for them or to avoid them. Dates move a little from one year to the next, so check the organisers' sites before you fix your flights.",
          ],
        },
        {
          h: "January: the Music Festival",
          p: [
            "The St Barts Music Festival brings classical musicians, jazz players and dancers to the island for about two weeks in January, with concerts in the churches of Gustavia and Lorient and a few open-air evenings. Low-key, excellent, and the island is at its prettiest once the holiday crowd has left.",
          ],
        },
        {
          h: "February and March: Carnival",
          p: [
            "Carnival builds up through February with parades in Gustavia and ends on Mardi Gras and Ash Wednesday, when Vaval, the carnival king, is burned on Shell Beach. Loud, local and great fun with children.",
          ],
          places: ["shell-beach"],
        },
        {
          h: "March: the Bucket Regatta",
          p: [
            "For four days in mid-March the world's largest sailing yachts race around the island and fill Gustavia harbour. If you don't sail, the best seats are the terraces above Gustavia and the hills along the course; from Pointe Milou you watch them pass offshore.",
          ],
        },
        {
          h: "April: Les Voiles de Saint-Barth",
          p: [
            "A week of racing for a hundred or so yachts, from the big maxis to local boats, with parties in the harbour every evening. Late April also brings the St Barth Film Festival, a few days of Caribbean cinema in Gustavia.",
          ],
        },
        {
          h: "May and June: the quiet pleasures",
          p: [
            "No big events, which is exactly the point: warmer sea, calm island, easy tables. Every other spring, the Transat Paprec, a two-handed sailing race from Concarneau in Brittany, finishes in Gustavia, and the harbour fills with small, fast boats and their tired crews.",
          ],
        },
        {
          h: "July and August: the fêtes",
          p: [
            "Bastille Day on 14 July is celebrated in Gustavia with fireworks. Then the villages take turns through August, each with its own fête of music, food and boat races: the island's own day, the Fête de la Saint-Barthélemy, is on 24 August with a regatta and fireworks over Gustavia harbour, and Corossol follows with the Fête de Saint-Louis on the 25th.",
          ],
          places: ["corossol-beach"],
        },
        {
          h: "September and October: the pause",
          p: [
            "Nothing on the calendar. Many restaurants and some hotels close for a few weeks so their teams can take their own holidays, and the island reopens for Thanksgiving.",
          ],
        },
        {
          h: "November: Gourmet Festival, Cata Cup, Thanksgiving",
          p: [
            "In the first half of November the Saint-Barth Gourmet Festival pairs visiting Michelin-starred chefs with the island's restaurants for a week of special menus; book those dinners early. The St Barth Cata Cup, a beach-catamaran regatta launched from St Jean, follows in the second half of the month. Thanksgiving week is when the season really starts.",
          ],
          places: ["st-jean-beach-restaurants-side"],
        },
        {
          h: "December: Christmas and New Year",
          p: [
            "Gustavia puts up its Christmas village, the harbour fills with the biggest yachts of the year, and on 31 December the New Year's Eve regatta sails around the island in the afternoon before the fireworks over the harbour at midnight. At the villa these two weeks are rented as 7-night packages and book out up to a year ahead.",
          ],
        },
      ],
      fr: [
        {
          h: "Pourquoi cela compte quand vous réservez",
          p: [
            "Quelques semaines par an, l'île se remplit, les restaurants affichent complet et le port devient un spectacle. C'est magnifique à voir, et bon à savoir, pour être là ou pour l'éviter. Les dates bougent un peu d'une année à l'autre : vérifiez les sites des organisateurs avant de fixer vos vols.",
          ],
        },
        {
          h: "Janvier : le Music Festival",
          p: [
            "Le St Barts Music Festival fait venir musiciens classiques, jazzmen et danseurs sur l'île pendant deux semaines environ en janvier, avec des concerts dans les églises de Gustavia et de Lorient et quelques soirées en plein air. Discret, excellent, et l'île est à son plus beau une fois la foule des fêtes repartie.",
          ],
        },
        {
          h: "Février et mars : le Carnaval",
          p: [
            "Le Carnaval monte en puissance tout février avec des défilés à Gustavia et se termine le Mardi gras et le mercredi des Cendres, quand Vaval, le roi du carnaval, est brûlé sur Shell Beach. Bruyant, local et très amusant avec des enfants.",
          ],
          places: ["shell-beach"],
        },
        {
          h: "Mars : la Bucket Regatta",
          p: [
            "Pendant quatre jours à la mi-mars, les plus grands voiliers du monde font le tour de l'île et remplissent le port de Gustavia. Si vous ne naviguez pas, les meilleures places sont les terrasses au-dessus de Gustavia et les collines le long du parcours ; depuis Pointe Milou, on les regarde passer au large.",
          ],
        },
        {
          h: "Avril : Les Voiles de Saint-Barth",
          p: [
            "Une semaine de régates pour une centaine de voiliers, des grands maxis aux bateaux locaux, avec des soirées sur le port chaque soir. Fin avril, le St Barth Film Festival propose aussi quelques jours de cinéma caribéen à Gustavia.",
          ],
        },
        {
          h: "Mai et juin : les plaisirs tranquilles",
          p: [
            "Pas de grand événement, et c'est justement l'intérêt : mer plus chaude, île calme, tables faciles. Un printemps sur deux, la Transat Paprec, course en double au départ de Concarneau, arrive à Gustavia, et le port se remplit de petits bateaux rapides et d'équipages fatigués.",
          ],
        },
        {
          h: "Juillet et août : les fêtes",
          p: [
            "Le 14 juillet se fête à Gustavia avec un feu d'artifice. Puis les villages se relaient tout le mois d'août, chacun avec sa fête, sa musique, ses repas et ses courses de bateaux : la fête de l'île, la Saint-Barthélemy, tombe le 24 août avec une régate et un feu d'artifice sur le port de Gustavia, et Corossol enchaîne avec la fête de la Saint-Louis le 25.",
          ],
          places: ["corossol-beach"],
        },
        {
          h: "Septembre et octobre : la pause",
          p: [
            "Rien au calendrier. Beaucoup de restaurants et certains hôtels ferment quelques semaines pour que leurs équipes partent à leur tour en vacances, et l'île rouvre pour Thanksgiving.",
          ],
        },
        {
          h: "Novembre : Gourmet Festival, Cata Cup, Thanksgiving",
          p: [
            "Dans la première moitié de novembre, le Saint-Barth Gourmet Festival associe des chefs étoilés invités aux restaurants de l'île pour une semaine de menus spéciaux ; réservez ces dîners tôt. La St Barth Cata Cup, régate de catamarans de sport lancée depuis St Jean, suit dans la seconde moitié du mois. La semaine de Thanksgiving marque le vrai début de la saison.",
          ],
          places: ["st-jean-beach-restaurants-side"],
        },
        {
          h: "Décembre : Noël et le Nouvel An",
          p: [
            "Gustavia installe son village de Noël, le port se remplit des plus grands yachts de l'année, et le 31 décembre la régate du Nouvel An fait le tour de l'île l'après-midi avant le feu d'artifice sur le port à minuit. À la villa, ces deux semaines se louent en forfaits de 7 nuits et se réservent jusqu'à un an à l'avance.",
          ],
        },
      ],
    },
  },
];

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
