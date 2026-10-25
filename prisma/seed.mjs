/**
 * Seed: base configuration (always) + demo dataset (SEED_DEMO=1).
 * Rates and business rules ported from the PHP version (PricingService.php).
 */
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const SETTINGS = {
  // Weekly rates (USD) per bedroom count — see src/lib/pricing.ts
  price_summer_2: "12500",
  price_summer_3: "13500",
  price_summer_4: "15500",
  price_low_season_2: "10000",
  price_low_season_3: "12000",
  price_low_season_4: "14000",
  price_winter_2: "18500",
  price_winter_3: "20000",
  price_winter_4: "21500",
  price_christmas: "40000",
  price_newyear: "50000",
  tax_rate: "5", // % tourist tax
  min_stay: "4",
  min_stay_peak: "7",
  deposit_percent: "30",
  // Loyalty program
  loyalty_earn_per_dollar: "0.01", // 1 point / $100 → points = amount * 0.01
  loyalty_point_value: "1", // 1 point = $1 credit
  loyalty_min_redeem: "100",
  loyalty_max_redeem_percent: "10", // max % of a stay payable in points
  // Profitability model (EUR) — from the PHP admin analysis panel
  cost_cleaning_per_day_eur: "66",
  cost_fixed_monthly_eur: "1501.90",
  eur_usd_rate: "1.08",
  // Contract / bank details (editable in Admin → Settings)
  owner_name: "Annie CHRIQUI",
  bank_account_name: "SCI Efis, Point Milou, 97133, St Barthelemy, France",
  bank_account_number: "00610660556",
  bank_name: "BRED Banque Populaire, St Barthelemy",
  bank_iban: "FR76 1010 7001 6600 6106 6055 692",
  bank_bic: "BREDFRPPXXX",
  // Contact
  contact_email: "annaerick971@gmail.com",
  contact_phone: "+590 690 39 90 47",
  contact_whatsapp: "+590690399047",
  villa_address: "Pointe Milou, 97133 Saint-Barthélemy",
  villa_map_url: "https://maps.app.goo.gl/9eV7KhFcF9AJdWeLA",
  // Public profiles (sameAs in structured data) and search-console tokens —
  // empty until filled in Réglages
  social_instagram: "",
  social_facebook: "",
  social_tripadvisor: "",
  social_google: "",
  social_youtube: "",
  // the villa's pages at the agencies it works with — the same house, so
  // the same entity (sameAs); this site is its official home
  listing_urls: [
    "https://www.wimco.com/villa-rentals/caribbean/st-barthelemy/only-view",
    "https://www.edenrockvillarental.com/en/st-barths/villa-search/only-view/",
    "https://www.myvillainstbarth.com/en/villas-rentals-st-barths/only-view-1-4",
    "https://www.corcoranstbarth.com/en/stbarts-villa-rentals/villa-only-view",
  ].join(" "),
  google_site_verification: "",
  bing_site_verification: "",
  villa_lat: "17.914904",
  villa_lng: "-62.816212",
  // Immersive 3D walkthrough embedded on the tour page (empty = hidden)
  tour_3d_url: "https://tour.giraffe360.com/51046496fd2c4761933549f4dfe3cfab/",
  // Loyalty programme: off for now — "1" brings it back everywhere
  loyalty_enabled: "0",
};

async function seedBase() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {}, // never overwrite operator-tuned values
    });
  }

  // The contact details shipped as placeholders until the owner's real ones
  // were known. Replace those exact values once — anything typed in Réglages
  // since is left alone.
  const PLACEHOLDERS = {
    contact_email: "contact@onlyviewstbarth.com",
    contact_phone: "+590 690 00 00 00",
    contact_whatsapp: "+590690000000",
    // the first seed guessed a pin 1.2 km west of the house; the island map
    // routes every itinerary from this point, so it has to be the real one
    villa_lat: "17.9124",
    villa_lng: "-62.8272",
    // the listings shipped empty before the agencies' URLs were known
    listing_urls: "",
  };
  for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
    const current = await prisma.setting.findUnique({ where: { key } });
    if (current && current.value.trim() === placeholder) {
      await prisma.setting.update({ where: { key }, data: { value: SETTINGS[key] } });
    }
  }

  // First-boot owner account — only when the instance has no users at all.
  // Once the legacy migration or the admin has created accounts (possibly
  // renaming this one, or giving another the owner's email), the seed leaves
  // users alone: an upsert on the username used to try to *create* a second
  // account with the same email and abort the whole boot on the unique index.
  if ((await prisma.user.count()) === 0) {
    const ownerPass = process.env.SEED_ADMIN_PASSWORD ?? "onlyview2026";
    await prisma.user.create({
      data: {
        username: "admin",
        email: "annaerick971@gmail.com",
        passwordHash: await bcrypt.hash(ownerPass, 12),
        firstname: "Annie",
        lastname: "Chriqui",
        role: "owner",
        mustChangePassword: true,
      },
    });
  }

  // Agencies (from the PHP admin selector)
  for (const a of [
    { name: "Eden Rock", code: "EDENROCK", commissionPercent: 25 },
    { name: "Wimco", code: "WIMCO", commissionPercent: 20 },
    { name: "MyVilla", code: "MYVILLA", commissionPercent: 15 },
  ]) {
    await prisma.agency.upsert({
      where: { name: a.name },
      create: a,
      update: {},
    });
  }

  // Photos from the media manifest
  const manifestPath = path.join(__dirname, "..", "src", "data", "photos.json");
  if (fs.existsSync(manifestPath)) {
    const photos = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const count = await prisma.photo.count();
    if (count === 0) {
      const ALTS = {
        living: "Open-plan living room with panoramic Caribbean sea view",
        "pool-terrace": "Heated private pool and terrace overlooking the ocean",
        kitchen: "Fully equipped gourmet kitchen",
        bedroom1: "Master bedroom with en-suite bathroom and ocean view",
        bedroom2: "Second en-suite bedroom",
        bedroom3: "Third en-suite bedroom",
        bedroom4: "Fourth en-suite bedroom",
        night: "Villa ONLY VIEW illuminated at night above Pointe Milou bay",
        exterior: "Villa ONLY VIEW hillside exterior in Pointe Milou, St Barth",
      };
      let i = 0;
      for (const p of photos) {
        i += 1;
        await prisma.photo.create({
          data: {
            category: p.category,
            url: p.url,
            width: p.width,
            height: p.height,
            alt: `${ALTS[p.category] ?? "Villa ONLY VIEW"} — photo ${p.url.slice(-7, -5)}`,
            sortOrder: i,
          },
        });
      }
      console.log(`Seeded ${photos.length} photos`);
    } else {
      // keep stored dimensions in step with re-encoded media (same URLs)
      let refreshed = 0;
      for (const p of photos) {
        const { count: n } = await prisma.photo.updateMany({
          where: { url: p.url, NOT: { width: p.width, height: p.height } },
          data: { width: p.width, height: p.height },
        });
        refreshed += n;
      }
      if (refreshed > 0) console.log(`Refreshed dimensions of ${refreshed} photos`);
    }
  }

  // Approved testimonials (guestbook)
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        {
          name: "Sarah & James M.",
          country: "United States",
          rating: 5,
          message:
            "The view from the pool at sunset is something we will never forget. The villa is immaculate, the concierge arranged everything from restaurants to a boat day. Booking direct with Annie was easy and personal.",
          language: "en",
          isApproved: true,
          isFeatured: true,
          stayDate: new Date("2026-02-14"),
        },
        {
          name: "Claire D.",
          country: "France",
          rating: 5,
          message:
            "Une semaine magique à Pointe Milou. La villa est encore plus belle qu'en photos, la piscine chauffée face à la baie est un rêve. Merci pour l'accueil et les attentions.",
          language: "fr",
          isApproved: true,
          isFeatured: true,
          stayDate: new Date("2026-01-05"),
        },
        {
          name: "The Rossi Family",
          country: "Italy",
          rating: 5,
          message:
            "Four bedrooms, four bathrooms, one incredible view. Perfect for our two families. The kids lived in the pool, we lived on the terrace. We are already planning our return.",
          language: "en",
          isApproved: true,
          isFeatured: true,
          stayDate: new Date("2025-12-08"),
        },
        {
          name: "Michael K.",
          country: "United Kingdom",
          rating: 5,
          message:
            "Sunsets over the bay, total privacy, and a five-minute drive to the best restaurants on the island. The direct booking process with the owner was seamless — contract signed online in minutes.",
          language: "en",
          isApproved: true,
          isFeatured: false,
          stayDate: new Date("2025-11-20"),
        },
        {
          name: "Ana & Pedro",
          country: "Brazil",
          rating: 5,
          message:
            "A vista é tudo — e é ainda melhor ao vivo. Casa impecável, cozinha completa, e o pôr do sol mais bonito de St Barth.",
          language: "pt",
          isApproved: true,
          isFeatured: false,
          stayDate: new Date("2026-03-02"),
        },
      ],
    });
    console.log("Seeded testimonials");
  }

  // Island map pins (beaches, restaurants, shops…) from the legacy map.php
  // and restaurants table. Create-only: a pin the owner has moved, renamed
  // or given via-points in the admin keeps its edits; a deleted pin stays
  // deleted unless it is missing from the table entirely.
  const placesPath = path.join(__dirname, "..", "src", "data", "map-places.json");
  if (fs.existsSync(placesPath) && (await prisma.mapPlace.count()) === 0) {
    const places = JSON.parse(fs.readFileSync(placesPath, "utf8"));
    await prisma.mapPlace.createMany({ data: places, skipDuplicates: true });
    console.log(`Seeded ${places.length} map places`);
  }
  await applyMapBatches();

  // A visible promotion example
  if ((await prisma.promotion.count()) === 0) {
    await prisma.promotion.create({
      data: {
        name: "Long stay — 5% off",
        description: "Stay 14 nights or more and save 5% on the rental rate.",
        discountType: "percent",
        discountValue: 5,
        minNights: 14,
        isActive: true,
        showOnWebsite: true,
        priority: 1,
      },
    });
  }
}

// Pins added to map-places.json after a database was first seeded. The table
// is only seeded when empty, so each batch is applied once per database (a
// Setting row marks it done): later deletes and edits in Admin → Carte stick.
const MAP_BATCHES = [
  {
    key: "map_batch_2026_10_restaurants",
    add: [
      "eddys-ghetto", "le-diamant", "le-jardin-sbh", "le-portugal", "les-bananiers", "la-guerite-gustavia",
      "burger-palace", "caribbean-to-go", "creage-to-go", "heiko", "koi-sushi-bar", "lenvol",
      "la-cantine-anse-caraibes", "la-creperie", "la-pizzetta", "la-saintoise", "le-bouchon",
      "papas-pizza", "so-cuisine", "st-barth-burger",
      "martini-bar", "modjo", "le-glacier", "le-petit-deauville", "natural-delights",
    ],
    // copy these fields from map-places.json onto an existing pin, unless the
    // owner already changed it (it no longer matches `when`)
    update: [
      // the restaurant at Hotel Le Christopher reopened as Solis
      {
        slug: "christo",
        when: { name: "La Plage du Christo - Hotel Christopher" },
        fields: ["name", "kind", "descriptionEn", "descriptionFr", "website", "phone"],
      },
      // a sit-down restaurant, not a snack
      { slug: "fish-corner", when: { kind: "snack" }, fields: ["kind"] },
    ],
  },
];

async function applyMapBatches() {
  const placesPath = path.join(__dirname, "..", "src", "data", "map-places.json");
  if (!fs.existsSync(placesPath)) return;
  const bySlug = new Map(JSON.parse(fs.readFileSync(placesPath, "utf8")).map((p) => [p.slug, p]));
  for (const batch of MAP_BATCHES) {
    if (await prisma.setting.findUnique({ where: { key: batch.key } })) continue;
    let added = 0;
    for (const slug of batch.add ?? []) {
      const place = bySlug.get(slug);
      if (!place || (await prisma.mapPlace.findUnique({ where: { slug } }))) continue;
      await prisma.mapPlace.create({ data: place });
      added++;
    }
    for (const { slug, when, fields } of batch.update ?? []) {
      const place = bySlug.get(slug);
      const row = await prisma.mapPlace.findUnique({ where: { slug } });
      if (!place || !row || Object.entries(when).some(([k, v]) => row[k] !== v)) continue;
      await prisma.mapPlace.update({
        where: { slug },
        data: Object.fromEntries(fields.map((f) => [f, place[f]])),
      });
    }
    await prisma.setting.create({ data: { key: batch.key, value: new Date().toISOString() } });
    console.log(`Map batch ${batch.key}: ${added} pin(s) added`);
  }
}

async function seedDemo() {
  if ((await prisma.client.count()) > 0) {
    console.log("Demo data already present — skipping");
    return;
  }
  const y = new Date().getFullYear();

  const mkClient = (data) => prisma.client.create({ data });

  const alice = await mkClient({
    firstname: "Alexandra",
    lastname: "Whitmore",
    email: "alexandra.whitmore@example.com",
    phone: "+1 212 555 0147",
    country: "United States",
    language: "en",
    isVip: true,
  });
  const marc = await mkClient({
    firstname: "Marc",
    lastname: "Delacroix",
    email: "marc.delacroix@example.com",
    phone: "+33 6 12 34 56 78",
    country: "France",
    language: "fr",
  });
  const sofia = await mkClient({
    firstname: "Sofia",
    lastname: "Bergström",
    email: "sofia.bergstrom@example.com",
    phone: "+46 70 123 45 67",
    country: "Sweden",
    language: "en",
  });

  const edenRock = await prisma.agency.findUnique({ where: { name: "Eden Rock" } });

  const mk = async (r) => {
    const tax = Math.round(r.priceHT * 0.05);
    return prisma.reservation.create({
      data: {
        status: r.status,
        startDate: new Date(r.start),
        endDate: new Date(r.end),
        clientId: r.client.id,
        clientName: `${r.client.firstname} ${r.client.lastname}`,
        email: r.client.email,
        bedrooms: r.bedrooms,
        guests: r.guests,
        priceHT: r.priceHT,
        taxAmount: tax,
        priceTTC: r.priceHT + tax,
        depositAmount: Math.round((r.priceHT + tax) * 0.3),
        depositReceived: r.depositReceived ?? false,
        balanceReceived: r.balanceReceived ?? false,
        agencyId: r.agencyId,
        agencyFeePercent: r.agencyFeePercent ?? 0,
        optionExpires: r.optionExpires ? new Date(r.optionExpires) : null,
      },
    });
  };

  // Past stay (paid) — feeds loyalty + finance history
  const past = await mk({
    client: alice,
    start: `${y - 1}-12-19`,
    end: `${y - 1}-12-27`,
    bedrooms: 4,
    guests: 8,
    status: "confirmed",
    priceHT: 45714,
    depositReceived: true,
    balanceReceived: true,
  });
  await prisma.payment.createMany({
    data: [
      {
        reservationId: past.id,
        kind: "deposit",
        amount: Math.round(past.priceTTC * 0.3),
        receivedAt: new Date(`${y - 1}-09-15`),
      },
      {
        reservationId: past.id,
        kind: "balance",
        amount: past.priceTTC - Math.round(past.priceTTC * 0.3),
        receivedAt: new Date(`${y - 1}-11-19`),
      },
    ],
  });

  // Upcoming confirmed (deposit in)
  const upcoming = await mk({
    client: marc,
    start: `${y}-11-08`,
    end: `${y}-11-16`,
    bedrooms: 3,
    guests: 6,
    status: "confirmed",
    priceHT: 22857,
    depositReceived: true,
  });
  await prisma.payment.create({
    data: {
      reservationId: upcoming.id,
      kind: "deposit",
      amount: Math.round(upcoming.priceTTC * 0.3),
      receivedAt: new Date(`${y}-08-02`),
    },
  });

  // Option with expiry
  await mk({
    client: sofia,
    start: `${y + 1}-02-10`,
    end: `${y + 1}-02-18`,
    bedrooms: 4,
    guests: 7,
    status: "option",
    priceHT: 24571,
    agencyId: edenRock?.id,
    agencyFeePercent: edenRock?.commissionPercent ?? 25,
    optionExpires: `${y}-09-15`,
  });

  // Loyalty for the returning guest
  const account = await prisma.loyaltyAccount.create({
    data: {
      clientId: alice.id,
      points: 480,
      lifetimePoints: 480,
    },
  });
  await prisma.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      kind: "earn",
      points: 480,
      reason: `Stay ${y - 1}-12-19 → ${y - 1}-12-27`,
      reservationId: past.id,
      createdBy: "system",
    },
  });

  // Expenses (recurring + one-off) — mirrors the PHP fixed-costs model
  await prisma.expense.createMany({
    data: [
      {
        date: new Date(`${y}-01-01`),
        category: "internet",
        amount: 81.9,
        description: "Fibre 5 Gbps",
        isFixed: true,
        frequency: "monthly",
        paymentDay: 5,
      },
      {
        date: new Date(`${y}-01-01`),
        category: "jardinier",
        amount: 480,
        description: "Jardinier",
        isFixed: true,
        frequency: "monthly",
        paymentDay: 10,
      },
      {
        date: new Date(`${y}-01-01`),
        category: "entretien",
        amount: 240,
        description: "Traitement moustiques",
        isFixed: true,
        frequency: "monthly",
        paymentDay: 15,
      },
      {
        date: new Date(`${y}-02-12`),
        category: "piscine",
        amount: 320,
        description: "Réparation pompe piscine",
      },
      {
        date: new Date(`${y}-03-03`),
        category: "electricite",
        amount: 512.4,
        description: "EDF janvier–février",
      },
    ],
  });

  // A pending booking request
  await prisma.bookingRequest.create({
    data: {
      startDate: new Date(`${y}-12-27`),
      endDate: new Date(`${y + 1}-01-03`),
      bedrooms: 4,
      guests: 8,
      name: "Jonathan Price",
      email: "jonathan.price@example.com",
      phone: "+1 305 555 0192",
      message: "New Year week for two families — is the villa available?",
      language: "en",
      status: "new",
    },
  });

  console.log("Seeded demo dataset");
}

/**
 * Concierge requests used to be stored as plain guest extras, with the time
 * and party size inside the notes ("20:00 · 4 pers. · ~€300"). Give them
 * their own kind and fields. Idempotent: only rows still marked as extras.
 */
async function backfillConciergeRequests() {
  const rows = await prisma.reservationExtra.findMany({
    where: { kind: "extra", requestedByGuest: true, extraId: null, notes: { contains: " pers." } },
  });
  for (const r of rows) {
    const [first, ...rest] = (r.notes ?? "").split("\n");
    const m = first.match(/^(?:(\d{2}:\d{2}) · )?(\d+) pers\.(?: · (.*))?$/);
    if (!m) continue;
    const category =
      r.placeId != null || r.label.startsWith("Restaurant — ")
        ? "restaurant"
        : /^(Private chef|Chef à domicile) — /.test(r.label)
          ? "chef"
          : "boat";
    await prisma.reservationExtra.update({
      where: { id: r.id },
      data: {
        kind: "concierge",
        category,
        serviceTime: m[1] ?? null,
        guests: parseInt(m[2], 10),
        notes: [m[3], ...rest].filter(Boolean).join("\n") || null,
      },
    });
  }
  if (rows.length) console.log(`Moved ${rows.length} concierge request(s) out of extras`);
}

/**
 * Extras = St Barth Provider's rental catalog (stbarthprovider.com/catalog-1,
 * prices read on 2026-10-25, EUR per day; 0 = on request). One-time import,
 * remembered in a setting (like the map batches), so everything stays
 * editable in Admin → Extras / Conciergerie afterwards. Guests see the euro
 * prices; the provider bills them, nothing is added to the villa's balance.
 */
const SB_PROVIDER_EXTRAS = [
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Wooden Crib",
    "nameFr": "Lit en bois",
    "price": 50,
    "descriptionEn": "Delivered with mattress & sheets",
    "descriptionFr": "Livré avec matelas et draps"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pack N' Play Crib",
    "nameFr": "Lit parapluie",
    "price": 35,
    "descriptionEn": "Delivered with mattress & sheets",
    "descriptionFr": "Livré avec matelas et draps"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Wooden Playpen + Mat",
    "nameFr": "Parc en bois + tapis",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "High Chair",
    "nameFr": "Chaise haute",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Booster Seat",
    "nameFr": "Rehausseur",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Changing Mat",
    "nameFr": "Matelas à langer",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bathtub",
    "nameFr": "Baignoire bébé",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bouncer",
    "nameFr": "Transat bébé",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bottle Warmer",
    "nameFr": "Chauffe-biberon",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Videophone",
    "nameFr": "Babyphone vidéo",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pair of Bedrails",
    "nameFr": "Paire de barrières de lit",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Basic Stroller",
    "nameFr": "Poussette",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Toy Basket & Play Mat",
    "nameFr": "Panier de jouets + tapis d'éveil",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Baby Pool",
    "nameFr": "Piscine bébé",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "UV Tent",
    "nameFr": "Tente anti-UV",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Baby Float",
    "nameFr": "Bouée bébé",
    "price": 8,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Beach Bucket Set",
    "nameFr": "Kit de plage (seau, pelle…)",
    "price": 8,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Kids Life Vest",
    "nameFr": "Gilet de sauvetage enfant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pool Security Fence",
    "nameFr": "Barrière de sécurité piscine",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Bedspring + Mattress",
    "nameFr": "Sommier + matelas",
    "price": 190,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Rollaway Comfort+",
    "nameFr": "Lit d'appoint Confort+",
    "price": 130,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Rollaway Bed",
    "nameFr": "Lit d'appoint",
    "price": 90,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Queen Air Bed",
    "nameFr": "Matelas gonflable 2 places",
    "price": 100,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Twin Air Bed",
    "nameFr": "Matelas gonflable 1 place",
    "price": 75,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Mattress Topper (twin or queen)",
    "nameFr": "Surmatelas (1 ou 2 places)",
    "price": 25,
    "descriptionEn": "From €25 (twin) to €35 (queen) per day",
    "descriptionFr": "De 25 € (1 place) à 35 € (2 places) par jour"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Slide",
    "nameFr": "Toboggan de piscine",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Water Trampoline",
    "nameFr": "Trampoline aquatique",
    "price": 50,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Kids Gliss Party",
    "nameFr": "Gliss Party enfants",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "XXL Float",
    "nameFr": "Bouée XXL",
    "price": 45,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Gold & Glitter Float",
    "nameFr": "Bouée Gold & Glitter",
    "price": 30,
    "descriptionEn": "From €30 to €45 per day depending on the model",
    "descriptionFr": "De 30 € à 45 € par jour selon le modèle"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Giant Wheel Roller",
    "nameFr": "Roue géante",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Waterpolo Goal",
    "nameFr": "But de water-polo",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Giant Floating Carpet",
    "nameFr": "Tapis flottant géant",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Lie-On Float",
    "nameFr": "Matelas flottant",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Basketball Hoop",
    "nameFr": "Panier de basket flottant",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Volleyball Net",
    "nameFr": "Filet de volley de piscine",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "2 Rafts + 2 Noodles",
    "nameFr": "2 matelas + 2 frites",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Floating Bar",
    "nameFr": "Bar flottant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Foam Pool Float",
    "nameFr": "Matelas mousse",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Beach Cabana + Blanket",
    "nameFr": "Cabane de plage + plaid",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "2 Big Chairs + Umbrella",
    "nameFr": "2 grandes chaises + parasol",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "2 Small Chairs + Umbrella",
    "nameFr": "2 petites chaises + parasol",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Medium Cooler",
    "nameFr": "Glacière moyenne",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Giant Island Hammock",
    "nameFr": "Hamac flottant géant",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Adult Snorkel Kit",
    "nameFr": "Kit de snorkeling adulte",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Kid Snorkel Kit",
    "nameFr": "Kit de snorkeling enfant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Bodyboard",
    "nameFr": "Bodyboard",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Solid Paddle Board",
    "nameFr": "Paddle rigide",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Waterpark",
    "nameFr": "Parc aquatique gonflable",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Time",
    "nameFr": "Pack Baby Time",
    "price": 50,
    "descriptionEn": "1 crib, 1 high chair, 1 bathtub",
    "descriptionFr": "1 lit, 1 chaise haute, 1 baignoire"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Playtime",
    "nameFr": "Pack Baby Playtime",
    "price": 60,
    "descriptionEn": "1 wooden playpen, mat, 1 toy basket, 1 tunnel",
    "descriptionFr": "1 parc en bois, tapis, 1 panier de jouets, 1 tunnel"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Beach Time",
    "nameFr": "Pack Baby Beach Time",
    "price": 30,
    "descriptionEn": "1 UV tent, 1 baby pool, 1 beach bucket set, 1 baby float, 1 sand-free beach mat",
    "descriptionFr": "1 tente anti-UV, 1 piscine bébé, 1 kit de plage, 1 bouée bébé, 1 tapis anti-sable"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Fun Pool Time",
    "nameFr": "Pack Fun Pool Time",
    "price": 45,
    "descriptionEn": "1 ring float, 2 pool rafts, 2 noodles, 1 animal floater",
    "descriptionFr": "1 bouée, 2 matelas, 2 frites, 1 bouée animal"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Beach Time",
    "nameFr": "Pack Beach Time",
    "price": 35,
    "descriptionEn": "2 big chairs, 1 umbrella, 1 small cooler, 1 waterproof speaker",
    "descriptionFr": "2 grandes chaises, 1 parasol, 1 petite glacière, 1 enceinte étanche"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Fitness Time",
    "nameFr": "Pack Fitness Time",
    "price": 30,
    "descriptionEn": "1 mat, 2 weights, 2 ankle weights, 1 jumping rope, 1 elastic band, 1 TRX",
    "descriptionFr": "1 tapis, 2 haltères, 2 lests de cheville, 1 corde à sauter, 1 élastique, 1 TRX"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Beach Set Up for the Day",
    "nameFr": "Installation plage pour la journée",
    "price": 0,
    "descriptionEn": "Beach cabana, table, beach chairs, blanket, cooler",
    "descriptionFr": "Cabane de plage, table, chaises, plaid, glacière"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Adjustable Dumbbells",
    "nameFr": "Haltères réglables",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Peloton Bike",
    "nameFr": "Vélo Peloton",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Treadmill",
    "nameFr": "Tapis de course",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Reformer Pilates",
    "nameFr": "Reformer Pilates",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Ice Bath Tub",
    "nameFr": "Bain de glace",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Compression Boots",
    "nameFr": "Bottes de compression",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Mirror Booth",
    "nameFr": "Photobooth miroir",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Classic Booth",
    "nameFr": "Photobooth classique",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Karaoke Box",
    "nameFr": "Karaoké",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "PlayStation 5",
    "nameFr": "PlayStation 5",
    "price": 45,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Clothes Rack + Hangers",
    "nameFr": "Portant + cintres",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Mirror",
    "nameFr": "Miroir sur pied",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Steamer",
    "nameFr": "Défroisseur vapeur",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Handsteamer",
    "nameFr": "Défroisseur à main",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Yoga Mat",
    "nameFr": "Tapis de yoga",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Tables & Chairs",
    "nameFr": "Tables et chaises",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null
  }
];

async function seedStBarthProviderExtras() {
  const key = "extras_batch_sb_provider_2026_10";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const partner = await prisma.servicePartner.upsert({
    where: { kind_name: { kind: "extras", name: "St Barth Provider" } },
    update: {},
    create: {
      kind: "extras",
      name: "St Barth Provider",
      phone: "+590 690 76 47 58",
      email: "reservation@stbarthprovider.com",
      website: "https://www.stbarthprovider.com",
      notes: "Location de matériel (bébé, couchage, piscine, plage, sport, fête). Prix en € par jour.",
      currency: "EUR",
    },
  });
  await prisma.extra.createMany({
    data: SB_PROVIDER_EXTRAS.map((x, i) => ({
      ...x,
      unit: "night",
      partnerId: partner.id,
      isActive: true,
      guestBookable: true,
      sortOrder: 100 + i,
    })),
  });
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  console.log(`Imported ${SB_PROVIDER_EXTRAS.length} St Barth Provider extras`);
}

async function main() {
  await seedBase();
  await backfillConciergeRequests();
  await seedStBarthProviderExtras();
  if (process.env.SEED_DEMO === "1") {
    await seedDemo();
  }
  console.log("\nSeed complete.");
  console.log("Admin login → user: admin  password:", process.env.SEED_ADMIN_PASSWORD ?? "onlyview2026", "(change it after first login)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
