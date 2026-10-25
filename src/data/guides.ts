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
            "San Juan, Puerto Rico (SJU) is the other option, and often the easier one if you're coming from the US: lots of flights, US domestic arrivals, no extra passport control. From San Juan, Tradewind Aviation flies you to St Barth in about an hour. One thing people mix up: Tradewind only flies from San Juan, not from St Maarten.",
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
            "San Juan, à Porto Rico (SJU), est l'autre option, souvent la plus simple depuis les États-Unis : beaucoup de vols, et ce sont des vols intérieurs américains. Depuis San Juan, Tradewind Aviation vous emmène à St Barth en une heure environ. Petite précision que beaucoup confondent : Tradewind ne vole que depuis San Juan, pas depuis St Maarten.",
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
];

export function getGuide(slug: string): GuideArticle | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
