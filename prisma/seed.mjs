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
  {
    // the concierge's activity providers (Alan, 2026-10-26)
    key: "map_batch_2026_10_activities",
    add: ["serial-divers", "carib-waterplay", "jet-ski-tour", "jet-ski-racing", "master-ski-pilou"],
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
    "descriptionFr": "Livré avec matelas et draps",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_47536d31e8bb4079b11cf5ee3bc78c9d~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_47536d31e8bb4079b11cf5ee3bc78c9d~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pack N' Play Crib",
    "nameFr": "Lit parapluie",
    "price": 35,
    "descriptionEn": "Delivered with mattress & sheets",
    "descriptionFr": "Livré avec matelas et draps",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_5d41b6a6f4414dde89af01b210cefcfc~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_5d41b6a6f4414dde89af01b210cefcfc~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Wooden Playpen + Mat",
    "nameFr": "Parc en bois + tapis",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_85bf707e6d3347c1bf5cf22195eb7bcb~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_85bf707e6d3347c1bf5cf22195eb7bcb~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "High Chair",
    "nameFr": "Chaise haute",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_181d3a8e9b01482dbe50322f39971b91~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_181d3a8e9b01482dbe50322f39971b91~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Booster Seat",
    "nameFr": "Rehausseur",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_a114abacdce84a209ceac96335866d01~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_85/61fde6_a114abacdce84a209ceac96335866d01~mv2.jpeg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Changing Mat",
    "nameFr": "Matelas à langer",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_e9aa23cac95c4a7698aa832063c6cdfc~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_e9aa23cac95c4a7698aa832063c6cdfc~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bathtub",
    "nameFr": "Baignoire bébé",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_fc1f56d770904aed9645e89c91161843~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_fc1f56d770904aed9645e89c91161843~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bouncer",
    "nameFr": "Transat bébé",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_1ad1296965e4424e85f3b42cc1e9509d~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_1ad1296965e4424e85f3b42cc1e9509d~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Bottle Warmer",
    "nameFr": "Chauffe-biberon",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_525e9acd2eea47c4a12cdba249d4af26~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_525e9acd2eea47c4a12cdba249d4af26~mv2.png"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Videophone",
    "nameFr": "Babyphone vidéo",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_769ab3bc7d314e309e66f4b2c045f5b8~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_769ab3bc7d314e309e66f4b2c045f5b8~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pair of Bedrails",
    "nameFr": "Paire de barrières de lit",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_62dc56c821e64204be677324546cc0a2~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_62dc56c821e64204be677324546cc0a2~mv2.png"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Basic Stroller",
    "nameFr": "Poussette",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_5ebc45f2d8924221a981a962b5694b5c~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_5ebc45f2d8924221a981a962b5694b5c~mv2.png"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Toy Basket & Play Mat",
    "nameFr": "Panier de jouets + tapis d'éveil",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_20a9ffdcc3a4418ca0f8e9b7893438b8~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_20a9ffdcc3a4418ca0f8e9b7893438b8~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Baby Pool",
    "nameFr": "Piscine bébé",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_b8b13380159848199c4794b9a20228a5~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_b8b13380159848199c4794b9a20228a5~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "UV Tent",
    "nameFr": "Tente anti-UV",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_a7df76154b9b4abbb7245de6b914bcf8~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_a7df76154b9b4abbb7245de6b914bcf8~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Baby Float",
    "nameFr": "Bouée bébé",
    "price": 8,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_573a0546eea247718ba6cdfa680646ce~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_573a0546eea247718ba6cdfa680646ce~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Beach Bucket Set",
    "nameFr": "Kit de plage (seau, pelle…)",
    "price": 8,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_0fae3344d9334dc98f93d99785ebd98c~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_0fae3344d9334dc98f93d99785ebd98c~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Kids Life Vest",
    "nameFr": "Gilet de sauvetage enfant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_df41eefc10414fc1bda2e640fa170ea1~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_df41eefc10414fc1bda2e640fa170ea1~mv2.jpg"
  },
  {
    "categoryEn": "Baby",
    "categoryFr": "Bébé",
    "nameEn": "Pool Security Fence",
    "nameFr": "Barrière de sécurité piscine",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_16256cefcf2647de9f2304093b9c1439~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_16256cefcf2647de9f2304093b9c1439~mv2.jpg"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Bedspring + Mattress",
    "nameFr": "Sommier + matelas",
    "price": 190,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_335deb51a6024398b2b87ae8ec244a52~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_335deb51a6024398b2b87ae8ec244a52~mv2.jpg"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Rollaway Comfort+",
    "nameFr": "Lit d'appoint Confort+",
    "price": 130,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_c7446fb8468a44a1b2f572b41b1b1bce~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_c7446fb8468a44a1b2f572b41b1b1bce~mv2.jpg"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Rollaway Bed",
    "nameFr": "Lit d'appoint",
    "price": 90,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_b1aa8404978f44d9beb5aeca4cb93f61~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_b1aa8404978f44d9beb5aeca4cb93f61~mv2.jpg"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Queen Air Bed",
    "nameFr": "Matelas gonflable 2 places",
    "price": 100,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_5aca826e95124b4eb72da2975661c47c~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_5aca826e95124b4eb72da2975661c47c~mv2.png"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Twin Air Bed",
    "nameFr": "Matelas gonflable 1 place",
    "price": 75,
    "descriptionEn": "Sheets for 1 week, pillow and duvet included",
    "descriptionFr": "Draps pour 1 semaine, oreiller et couette inclus",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_423a79b83cc04ad69b4e5098758c8a8d~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_423a79b83cc04ad69b4e5098758c8a8d~mv2.jpg"
  },
  {
    "categoryEn": "Sleep",
    "categoryFr": "Couchage",
    "nameEn": "Mattress Topper (twin or queen)",
    "nameFr": "Surmatelas (1 ou 2 places)",
    "price": 25,
    "descriptionEn": "From €25 (twin) to €35 (queen) per day",
    "descriptionFr": "De 25 € (1 place) à 35 € (2 places) par jour",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_db34b126cfab423c99be0768d08cb233~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_db34b126cfab423c99be0768d08cb233~mv2.png"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Slide",
    "nameFr": "Toboggan de piscine",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_700597333b124af89a722ccbffd92c8e~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_700597333b124af89a722ccbffd92c8e~mv2.png"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Water Trampoline",
    "nameFr": "Trampoline aquatique",
    "price": 50,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_2140036a25c04501bfc36589ca009e5d~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_2140036a25c04501bfc36589ca009e5d~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Kids Gliss Party",
    "nameFr": "Gliss Party enfants",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_5cb8c56794824ef894d1a1248ec6bcab~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_5cb8c56794824ef894d1a1248ec6bcab~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "XXL Float",
    "nameFr": "Bouée XXL",
    "price": 45,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_ca11f66a1273453c9c91cda72ed0a245~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_ca11f66a1273453c9c91cda72ed0a245~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Gold & Glitter Float",
    "nameFr": "Bouée Gold & Glitter",
    "price": 30,
    "descriptionEn": "From €30 to €45 per day depending on the model",
    "descriptionFr": "De 30 € à 45 € par jour selon le modèle",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_3bcfdb9d65394e66afcbdb54e7047918~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_3bcfdb9d65394e66afcbdb54e7047918~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Giant Wheel Roller",
    "nameFr": "Roue géante",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_2bc154b73af240a796fa60174b896139~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_2bc154b73af240a796fa60174b896139~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Waterpolo Goal",
    "nameFr": "But de water-polo",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_8595566739594c1092ea94fe8b12ff3a~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_8595566739594c1092ea94fe8b12ff3a~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Giant Floating Carpet",
    "nameFr": "Tapis flottant géant",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_4043d97a9e084c02a0d13dd541c2aa33~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_4043d97a9e084c02a0d13dd541c2aa33~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Lie-On Float",
    "nameFr": "Matelas flottant",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_defb4d09ad344421b14428d8d86f0212~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_defb4d09ad344421b14428d8d86f0212~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Basketball Hoop",
    "nameFr": "Panier de basket flottant",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_ed767120e4794d14ba36da24695ed9f3~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_ed767120e4794d14ba36da24695ed9f3~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Pool Volleyball Net",
    "nameFr": "Filet de volley de piscine",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_f502ed43732940b6ae79705a2cdf3550~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_f502ed43732940b6ae79705a2cdf3550~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "2 Rafts + 2 Noodles",
    "nameFr": "2 matelas + 2 frites",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_ceb0d4d792064fbb87e0b4d7e58d9cf7~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_ceb0d4d792064fbb87e0b4d7e58d9cf7~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Floating Bar",
    "nameFr": "Bar flottant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_ba1290069e3845e8a71cf81b3967bb35~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_ba1290069e3845e8a71cf81b3967bb35~mv2.jpg"
  },
  {
    "categoryEn": "Pool",
    "categoryFr": "Piscine",
    "nameEn": "Foam Pool Float",
    "nameFr": "Matelas mousse",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_c193528cc3dd4490be5c1c5461b961dc~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_c193528cc3dd4490be5c1c5461b961dc~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Beach Cabana + Blanket",
    "nameFr": "Cabane de plage + plaid",
    "price": 40,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_edcdfd520b7c499fb658ec143e2920b4~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_edcdfd520b7c499fb658ec143e2920b4~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "2 Big Chairs + Umbrella",
    "nameFr": "2 grandes chaises + parasol",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_8b02e0bf702e4891bdb8f6b9816ca144~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_8b02e0bf702e4891bdb8f6b9816ca144~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "2 Small Chairs + Umbrella",
    "nameFr": "2 petites chaises + parasol",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_1681c14aa8214da68a362b1ec892d471~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_1681c14aa8214da68a362b1ec892d471~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Medium Cooler",
    "nameFr": "Glacière moyenne",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_6ecb7f4deab14428a1e0557261d834b6~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_6ecb7f4deab14428a1e0557261d834b6~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Giant Island Hammock",
    "nameFr": "Hamac flottant géant",
    "price": 60,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_d80436076a694e01ab674db5af10da33~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_d80436076a694e01ab674db5af10da33~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Adult Snorkel Kit",
    "nameFr": "Kit de snorkeling adulte",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_7b4606d91b64473ba6b94700d61a4702~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_7b4606d91b64473ba6b94700d61a4702~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Kid Snorkel Kit",
    "nameFr": "Kit de snorkeling enfant",
    "price": 15,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_ea94484e75a342dc83528c15087fadfd~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_ea94484e75a342dc83528c15087fadfd~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Bodyboard",
    "nameFr": "Bodyboard",
    "price": 25,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_4271f8b393d142f9b62cd15bed51e8bb~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_4271f8b393d142f9b62cd15bed51e8bb~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Solid Paddle Board",
    "nameFr": "Paddle rigide",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_8401a40142b94951a7c655a8a41a3bcb~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_8401a40142b94951a7c655a8a41a3bcb~mv2.jpg"
  },
  {
    "categoryEn": "Beach",
    "categoryFr": "Plage",
    "nameEn": "Waterpark",
    "nameFr": "Parc aquatique gonflable",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_b794dc79ee5d4825beb574327ed54614~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_b794dc79ee5d4825beb574327ed54614~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Time",
    "nameFr": "Pack Baby Time",
    "price": 50,
    "descriptionEn": "1 crib, 1 high chair, 1 bathtub",
    "descriptionFr": "1 lit, 1 chaise haute, 1 baignoire",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_bfed8e61898c46de92ecaa823b9a34fa~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_bfed8e61898c46de92ecaa823b9a34fa~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Playtime",
    "nameFr": "Pack Baby Playtime",
    "price": 60,
    "descriptionEn": "1 wooden playpen, mat, 1 toy basket, 1 tunnel",
    "descriptionFr": "1 parc en bois, tapis, 1 panier de jouets, 1 tunnel",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_e6407ffe45824ec682dda2b0cdeee3af~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_e6407ffe45824ec682dda2b0cdeee3af~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Baby Beach Time",
    "nameFr": "Pack Baby Beach Time",
    "price": 30,
    "descriptionEn": "1 UV tent, 1 baby pool, 1 beach bucket set, 1 baby float, 1 sand-free beach mat",
    "descriptionFr": "1 tente anti-UV, 1 piscine bébé, 1 kit de plage, 1 bouée bébé, 1 tapis anti-sable",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_07ae6b5016484b4db6054b73733273d0~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_07ae6b5016484b4db6054b73733273d0~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Fun Pool Time",
    "nameFr": "Pack Fun Pool Time",
    "price": 45,
    "descriptionEn": "1 ring float, 2 pool rafts, 2 noodles, 1 animal floater",
    "descriptionFr": "1 bouée, 2 matelas, 2 frites, 1 bouée animal",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_7754e3a5e4864fd5b112db30d5ea526f~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_7754e3a5e4864fd5b112db30d5ea526f~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Beach Time",
    "nameFr": "Pack Beach Time",
    "price": 35,
    "descriptionEn": "2 big chairs, 1 umbrella, 1 small cooler, 1 waterproof speaker",
    "descriptionFr": "2 grandes chaises, 1 parasol, 1 petite glacière, 1 enceinte étanche",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_7868aae0ec3645d58beccaa10d9416cd~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_7868aae0ec3645d58beccaa10d9416cd~mv2.jpg"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Fitness Time",
    "nameFr": "Pack Fitness Time",
    "price": 30,
    "descriptionEn": "1 mat, 2 weights, 2 ankle weights, 1 jumping rope, 1 elastic band, 1 TRX",
    "descriptionFr": "1 tapis, 2 haltères, 2 lests de cheville, 1 corde à sauter, 1 élastique, 1 TRX",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_81502290cf8e421f9e2eb8654176c0f8~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_81502290cf8e421f9e2eb8654176c0f8~mv2.png"
  },
  {
    "categoryEn": "Packages",
    "categoryFr": "Packs",
    "nameEn": "Beach Set Up for the Day",
    "nameFr": "Installation plage pour la journée",
    "price": 0,
    "descriptionEn": "Beach cabana, table, beach chairs, blanket, cooler",
    "descriptionFr": "Cabane de plage, table, chaises, plaid, glacière",
    "imageUrl": "https://static.wixstatic.com/media/61fde6_d7a02f1736d04edc813a4eabbdb867a4~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_d7a02f1736d04edc813a4eabbdb867a4~mv2.jpg"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Adjustable Dumbbells",
    "nameFr": "Haltères réglables",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_1e01b7fcce334d45a91386e76cf9758e~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_1e01b7fcce334d45a91386e76cf9758e~mv2.jpg"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Peloton Bike",
    "nameFr": "Vélo Peloton",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_cd6babb7c1d2461d8b7b7e945e2f73e0~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_cd6babb7c1d2461d8b7b7e945e2f73e0~mv2.png"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Treadmill",
    "nameFr": "Tapis de course",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_91240af360024e9a8253da6c2deea786~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_91240af360024e9a8253da6c2deea786~mv2.png"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Reformer Pilates",
    "nameFr": "Reformer Pilates",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_304c9ce807c849aabffa5a40372bf2dc~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_304c9ce807c849aabffa5a40372bf2dc~mv2.jpg"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Ice Bath Tub",
    "nameFr": "Bain de glace",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_28a2bd47a67542d68d99733676ee4466~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_28a2bd47a67542d68d99733676ee4466~mv2.jpg"
  },
  {
    "categoryEn": "Fitness",
    "categoryFr": "Sport",
    "nameEn": "Compression Boots",
    "nameFr": "Bottes de compression",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_0c77ab2240e44a5b990df174f9ed5b45~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_0c77ab2240e44a5b990df174f9ed5b45~mv2.jpg"
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Mirror Booth",
    "nameFr": "Photobooth miroir",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_2be8f2f9c1a34f40b130fa565a3f0f21~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_2be8f2f9c1a34f40b130fa565a3f0f21~mv2.png"
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Classic Booth",
    "nameFr": "Photobooth classique",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_458882a3807f4c2ca9be12aabb0942be~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_458882a3807f4c2ca9be12aabb0942be~mv2.jpg"
  },
  {
    "categoryEn": "Party",
    "categoryFr": "Fête",
    "nameEn": "Karaoke Box",
    "nameFr": "Karaoké",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_8680c1f816fc48d385f01ffe38cd05f6~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_8680c1f816fc48d385f01ffe38cd05f6~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "PlayStation 5",
    "nameFr": "PlayStation 5",
    "price": 45,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_34d9f760e29e458aacc78b111b163303~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_34d9f760e29e458aacc78b111b163303~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Clothes Rack + Hangers",
    "nameFr": "Portant + cintres",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_65dad8a1845a414984b53a5880664557~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_65dad8a1845a414984b53a5880664557~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Mirror",
    "nameFr": "Miroir sur pied",
    "price": 35,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_1818a7a32a944da188eb567c773fb187~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_1818a7a32a944da188eb567c773fb187~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Steamer",
    "nameFr": "Défroisseur vapeur",
    "price": 30,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_673d4ea8098441dd9a9640e437ed6c26~mv2.png/v1/fill/w_600,h_600,al_c,q_85/61fde6_673d4ea8098441dd9a9640e437ed6c26~mv2.png"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Handsteamer",
    "nameFr": "Défroisseur à main",
    "price": 20,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_7c2c8a6094f042e997c281c53a86f5af~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_7c2c8a6094f042e997c281c53a86f5af~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Yoga Mat",
    "nameFr": "Tapis de yoga",
    "price": 10,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_04f8d0aa843b4b8b937a4ce3b6cdb076~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_04f8d0aa843b4b8b937a4ce3b6cdb076~mv2.jpg"
  },
  {
    "categoryEn": "Others",
    "categoryFr": "Divers",
    "nameEn": "Tables & Chairs",
    "nameFr": "Tables et chaises",
    "price": 0,
    "descriptionEn": null,
    "descriptionFr": null,
    "imageUrl": "https://static.wixstatic.com/media/61fde6_52978432d04b4884838c82095653aaae~mv2.jpg/v1/fill/w_600,h_600,al_c,q_85/61fde6_52978432d04b4884838c82095653aaae~mv2.jpg"
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

/**
 * The provider's own photos (their image URLs on stbarthprovider.com, as
 * Alan asked, 2026-10-25) for the extras imported before they were added:
 * once, and only on items still without a photo, so an edited one is kept.
 */
async function applyStBarthProviderPhotos() {
  const key = "extras_batch_sb_provider_photos_2026_10";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const partner = await prisma.servicePartner.findFirst({ where: { kind: "extras", name: "St Barth Provider" } });
  let n = 0;
  if (partner) {
    for (const x of SB_PROVIDER_EXTRAS) {
      const { count } = await prisma.extra.updateMany({
        where: { partnerId: partner.id, nameEn: x.nameEn, imageUrl: null },
        data: { imageUrl: x.imageUrl },
      });
      n += count;
    }
  }
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  if (n) console.log(`St Barth Provider photos added to ${n} extras`);
}

/**
 * Kinds of activity the guest portal's concierge offers (Admin → Conciergerie
 * → Types d'activités). No provider offers yet: guests ask, the owner finds
 * one. One-time batch, so categories Alan deletes or edits stay that way.
 */
const ACTIVITY_CATEGORIES = [
  {
    slug: "diving",
    icon: "diving",
    nameEn: "Scuba diving",
    nameFr: "Plongée sous-marine",
    descriptionEn: "A first dive or guided dives for certified divers in the island's marine reserve.",
    descriptionFr: "Baptême ou plongées encadrées pour plongeurs certifiés dans la réserve naturelle de l'île.",
  },
  {
    slug: "snorkeling",
    icon: "snorkel",
    nameEn: "Snorkeling",
    nameFr: "Snorkeling",
    descriptionEn: "Mask and snorkel with a guide, from the beach or by boat: turtles, rays and reef fish.",
    descriptionFr: "Palmes, masque et tuba avec un guide, depuis la plage ou en bateau : tortues, raies et poissons du récif.",
  },
  {
    slug: "jet-ski",
    icon: "jetski",
    nameEn: "Jet ski",
    nameFr: "Jet ski",
    descriptionEn: "Jet ski rental or a guided ride around the island.",
    descriptionFr: "Location de jet ski ou tour de l'île accompagné.",
  },
  {
    slug: "hiking",
    icon: "hiking",
    nameEn: "Hiking",
    nameFr: "Randonnée",
    descriptionEn: "The island's trails, such as Colombier or Grand Fond, on your own or with a guide.",
    descriptionFr: "Les sentiers de l'île, comme Colombier ou Grand Fond, seul ou avec un guide.",
  },
  {
    slug: "yoga",
    icon: "yoga",
    nameEn: "Yoga",
    nameFr: "Yoga",
    descriptionEn: "A private class at the villa, facing the sea, or a small-group session.",
    descriptionFr: "Un cours privé à la villa, face à la mer, ou une séance en petit groupe.",
  },
  {
    slug: "massage",
    icon: "massage",
    nameEn: "Massages",
    nameFr: "Massages",
    descriptionEn: "A massage at the villa or in a spa, solo or for two.",
    descriptionFr: "Un massage à la villa ou en spa, en solo ou en duo.",
  },
  {
    slug: "paddle-kayak",
    icon: "waves",
    nameEn: "Paddleboard & kayak",
    nameFr: "Paddle et kayak",
    descriptionEn: "Paddleboard or kayak rental, or a guided outing along the coast.",
    descriptionFr: "Location de paddle ou de kayak, ou balade guidée le long de la côte.",
  },
  {
    slug: "board-sports",
    icon: "waves",
    nameEn: "Surf, windsurf & kite",
    nameFr: "Surf, windsurf et kite",
    descriptionEn: "Surf, windsurf, wingfoil or kitesurf: lessons or rental, for beginners and experienced riders.",
    descriptionFr: "Surf, windsurf, wingfoil ou kitesurf : cours ou location, pour débutants comme confirmés.",
  },
  {
    slug: "fishing",
    icon: "fishing",
    nameEn: "Deep-sea fishing",
    nameFr: "Pêche au gros",
    descriptionEn: "A half or full day fishing trip with a skipper.",
    descriptionFr: "Une sortie de pêche d'une demi-journée ou d'une journée avec un skipper.",
  },
  {
    slug: "fitness",
    icon: "gym",
    nameEn: "Private coach",
    nameFr: "Coach sportif",
    descriptionEn: "A personal training session at the villa or outdoors.",
    descriptionFr: "Une séance de sport personnalisée à la villa ou en plein air.",
  },
  {
    slug: "tennis-padel",
    icon: "tennis",
    nameEn: "Tennis & padel",
    nameFr: "Tennis et padel",
    descriptionEn: "A court booking or a lesson with a coach.",
    descriptionFr: "La réservation d'un court ou un cours avec un professeur.",
  },
];

async function seedActivityCategories() {
  const key = "activity_categories_batch_2026_10";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const existing = new Set((await prisma.activityCategory.findMany({ select: { slug: true } })).map((c) => c.slug));
  const data = ACTIVITY_CATEGORIES.filter((c) => !existing.has(c.slug)).map((c, i) => ({
    ...c,
    isActive: true,
    sortOrder: (i + 1) * 10,
  }));
  if (data.length) await prisma.activityCategory.createMany({ data });
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  console.log(`Added ${data.length} activity categories`);
}

/**
 * Providers Alan named for the concierge's activities (2026-10-26) and their
 * published offers, prices in EUR as found on their sites that day. One-time
 * batch: edits and deletions in Admin → Conciergerie stay. An offer whose kind
 * of activity was deleted is skipped.
 */
const ACTIVITY_PARTNERS = [
  {
    name: "Serial Divers",
    phone: "+590 690 51 67 86",
    whatsapp: "+590 690 72 40 68",
    email: "booking@serialdivers.com",
    website: "https://www.serialdivers.com",
    location: "35 rue Schoelcher, Gustavia",
    notes: "Centre de plongée, départs de Gustavia. Prix saison 2026-2027 (tarif en ligne un peu moins cher).",
    offers: [
      {
        slug: "serial-divers-single-dive",
        category: "diving",
        name: "Single dive",
        nameFr: "Plongée simple",
        descriptionEn: "A guided dive on the marine reserve's sites, for certified divers.",
        descriptionFr: "Une plongée encadrée sur les sites de la réserve naturelle, pour plongeurs certifiés.",
        price: 100,
        priceType: "per_person",
      },
      {
        slug: "serial-divers-double-dive",
        category: "diving",
        name: "Double dive",
        nameFr: "Double plongée",
        descriptionEn: "Two dives in one outing, for certified divers.",
        descriptionFr: "Deux plongées dans la même sortie, pour plongeurs certifiés.",
        price: 190,
        priceType: "per_person",
      },
      {
        slug: "serial-divers-discover-scuba",
        category: "diving",
        name: "Discover scuba (baptême)",
        nameFr: "Baptême de plongée",
        descriptionEn: "A first dive with an instructor, no experience needed. From age 8.",
        descriptionFr: "Un premier contact avec la plongée, avec un moniteur, sans expérience. Dès 8 ans.",
        price: 110,
        priceType: "per_person",
      },
      {
        slug: "serial-divers-private-instructor",
        category: "diving",
        name: "Private instructor",
        nameFr: "Moniteur privé",
        descriptionEn: "An instructor for your group only. Starting price.",
        descriptionFr: "Un moniteur rien que pour votre groupe. Prix de départ.",
        price: 250,
        priceType: "per_group",
      },
      {
        slug: "serial-divers-private-boat",
        category: "diving",
        name: "Private dive boat",
        nameFr: "Bateau de plongée privatisé",
        descriptionEn: "The boat for your group, to dive or snorkel where you like. Starting price.",
        descriptionFr: "Le bateau pour votre groupe, pour plonger ou faire du snorkeling où vous voulez. Prix de départ.",
        price: 500,
        priceType: "per_group",
      },
      {
        slug: "serial-divers-guided-snorkeling",
        category: "snorkeling",
        name: "Guided snorkeling",
        nameFr: "Snorkeling guidé",
        descriptionEn: "A boat outing with a guide in the water with you.",
        descriptionFr: "Une sortie en bateau avec un guide dans l'eau avec vous.",
        price: 70,
        priceType: "per_person",
      },
      {
        slug: "serial-divers-snorkeling-trip",
        category: "snorkeling",
        name: "Snorkeling trip",
        nameFr: "Sortie snorkeling",
        descriptionEn: "A boat outing to snorkel on your own, gear included.",
        descriptionFr: "Une sortie en bateau pour faire du snorkeling en autonomie, matériel inclus.",
        price: 50,
        priceType: "per_person",
      },
      {
        slug: "serial-divers-freediving-intro",
        category: "snorkeling",
        name: "Freediving introduction",
        nameFr: "Initiation à l'apnée",
        descriptionEn: "Learn to breathe and dive on a single breath with an instructor.",
        descriptionFr: "Apprendre la respiration et la plongée en apnée avec un moniteur.",
        price: 90,
        priceType: "per_person",
      },
    ],
  },
  {
    name: "Carib Waterplay",
    phone: "+33 6 65 95 43 52",
    website: "https://caribwaterplay.com",
    location: "Plage de Saint-Jean, à côté du Pearl Beach",
    notes: "Ouvert tous les jours 9h-18h. Prix « à partir de » de leur fiche access.sb (oct. 2026). Numéro français : à confirmer.",
    offers: [
      {
        slug: "carib-waterplay-windsurf-lesson",
        category: "board-sports",
        name: "Windsurf lesson",
        nameFr: "Cours de windsurf",
        descriptionEn: "On Saint-Jean bay, for beginners and experienced riders. Starting price.",
        descriptionFr: "Dans la baie de Saint-Jean, pour débutants comme confirmés. Prix de départ.",
        price: 100,
        priceType: "per_person",
      },
      {
        slug: "carib-waterplay-wingfoil-lesson",
        category: "board-sports",
        name: "Wingfoil lesson",
        nameFr: "Cours de wingfoil",
        descriptionEn: "Starting price.",
        descriptionFr: "Prix de départ.",
        price: 100,
        priceType: "per_person",
      },
      {
        slug: "carib-waterplay-surf-lesson",
        category: "board-sports",
        name: "Surf lesson",
        nameFr: "Cours de surf",
        descriptionEn: "Starting price.",
        descriptionFr: "Prix de départ.",
        price: 90,
        priceType: "per_person",
      },
      {
        slug: "carib-waterplay-catamaran-lesson",
        category: "board-sports",
        name: "Catamaran sailing lesson",
        nameFr: "Cours de catamaran",
        descriptionEn: "Learn to sail a beach catamaran. Starting price.",
        descriptionFr: "Apprendre à naviguer sur un catamaran de plage. Prix de départ.",
        price: 160,
        priceType: "per_person",
      },
      {
        slug: "carib-waterplay-windsurf-rental",
        category: "board-sports",
        name: "Windsurf rental",
        nameFr: "Location de windsurf",
        descriptionEn: "By the hour or the day, cheaper for longer rentals. Starting price.",
        descriptionFr: "À l'heure ou à la journée, dégressif. Prix de départ.",
        price: 30,
        priceType: "per_unit",
      },
      {
        slug: "carib-waterplay-sup-kayak-excursion",
        category: "paddle-kayak",
        name: "Paddleboard or kayak excursion",
        nameFr: "Balade en paddle ou kayak",
        descriptionEn: "A guided outing along the coast. Starting price.",
        descriptionFr: "Une balade guidée le long de la côte. Prix de départ.",
        price: 90,
        priceType: "per_person",
      },
      {
        slug: "carib-waterplay-sup-rental",
        category: "paddle-kayak",
        name: "Paddleboard rental",
        nameFr: "Location de paddle",
        descriptionEn: "By the hour or the day. Starting price.",
        descriptionFr: "À l'heure ou à la journée. Prix de départ.",
        price: 25,
        priceType: "per_unit",
      },
      {
        slug: "carib-waterplay-kayak-rental",
        category: "paddle-kayak",
        name: "Kayak rental",
        nameFr: "Location de kayak",
        descriptionEn: "By the hour or the day. Starting price.",
        descriptionFr: "À l'heure ou à la journée. Prix de départ.",
        price: 20,
        priceType: "per_unit",
      },
    ],
  },
  {
    name: "Jet Ski Tour",
    contactName: "Jean-Christophe Prayas",
    phone: "+590 690 59 66 06",
    location: "Grand Cul-de-Sac, base nautique de l'hôtel Le Barthélemy (et Gustavia)",
    notes: "Sur réservation. Prix de leur fiche access.sb (oct. 2026).",
    offers: [
      {
        slug: "jet-ski-tour-30-min",
        category: "jet-ski",
        name: "Guided jet ski ride, 30 min",
        nameFr: "Balade guidée en jet ski, 30 min",
        descriptionEn:
          "With Jean-Christophe Prayas, offshore jet ski vice-champion, from the calm Grand Cul-de-Sac lagoon. Up to 2 people per jet ski.",
        descriptionFr:
          "Avec Jean-Christophe Prayas, vice-champion de jet offshore, depuis le lagon calme de Grand Cul-de-Sac. Jusqu'à 2 personnes par jet ski.",
        duration: "30 min",
        price: 100,
        priceType: "per_unit",
      },
      {
        slug: "jet-ski-tour-1-hour",
        category: "jet-ski",
        name: "Guided jet ski ride, 1 hour",
        nameFr: "Balade guidée en jet ski, 1 h",
        descriptionEn: "From Grand Cul-de-Sac with Jean-Christophe Prayas. Up to 2 people per jet ski.",
        descriptionFr: "Depuis Grand Cul-de-Sac avec Jean-Christophe Prayas. Jusqu'à 2 personnes par jet ski.",
        duration: "1 h",
        price: 150,
        priceType: "per_unit",
      },
      {
        slug: "jet-ski-tour-island-tour",
        category: "jet-ski",
        name: "Jet ski island tour",
        nameFr: "Tour de l'île en jet ski",
        descriptionEn: "All the way around St Barth with Jean-Christophe Prayas. Up to 2 people per jet ski.",
        descriptionFr: "Le tour complet de l'île avec Jean-Christophe Prayas. Jusqu'à 2 personnes par jet ski.",
        price: 195,
        priceType: "per_unit",
      },
    ],
  },
  {
    name: "Jet Ski Racing",
    phone: "+590 690 23 70 07",
    whatsapp: "+590 690 23 70 07",
    location: "Gustavia, départ de The Point",
    notes: "Ouvert 7j/7. Prix de leur grille 2023-24 : à vérifier.",
    offers: [
      {
        slug: "jet-ski-racing-group-1h",
        category: "jet-ski",
        name: "Group jet ski excursion, 1 hour",
        nameFr: "Excursion jet ski en groupe, 1 h",
        descriptionEn: "Guided group ride from Gustavia (at least 2 jet skis). Gear, towels and photos included.",
        descriptionFr: "Sortie guidée en groupe depuis Gustavia (2 jet skis minimum). Équipement, serviettes et photos inclus.",
        duration: "1 h",
        price: 160,
        priceType: "per_unit",
      },
      {
        slug: "jet-ski-racing-group-1h30",
        category: "jet-ski",
        name: "Group jet ski excursion, 1 h 30",
        nameFr: "Excursion jet ski en groupe, 1 h 30",
        descriptionEn: "Guided group ride from Gustavia (at least 2 jet skis).",
        descriptionFr: "Sortie guidée en groupe depuis Gustavia (2 jet skis minimum).",
        duration: "1 h 30",
        price: 190,
        priceType: "per_unit",
      },
      {
        slug: "jet-ski-racing-half-day",
        category: "jet-ski",
        name: "Jet ski rental, half day",
        nameFr: "Location de jet ski, demi-journée",
        descriptionEn: "Can be delivered to Saint-Jean, Gouverneur, Saline, Flamands or Shell Beach.",
        descriptionFr: "Livraison possible à Saint-Jean, Gouverneur, Saline, Flamands ou Shell Beach.",
        price: 520,
        priceType: "per_unit",
      },
      {
        slug: "jet-ski-racing-full-day",
        category: "jet-ski",
        name: "Jet ski rental, full day",
        nameFr: "Location de jet ski, journée",
        descriptionEn: "Can be delivered to Saint-Jean, Gouverneur, Saline, Flamands or Shell Beach.",
        descriptionFr: "Livraison possible à Saint-Jean, Gouverneur, Saline, Flamands ou Shell Beach.",
        price: 920,
        priceType: "per_unit",
      },
    ],
  },
  {
    name: "Master Ski Pilou",
    phone: "+590 590 27 91 79",
    location: "Rue Jeanne d'Arc, Gustavia",
    notes: "Tous les jours 7h-21h. Pas de prix publiés.",
    offers: [
      {
        slug: "master-ski-pilou-guided-tour",
        category: "jet-ski",
        name: "Guided jet ski tour",
        nameFr: "Balade guidée en jet ski",
        descriptionEn: "Along the coast from Gustavia. Fuel, guide, life jackets and water included. Drivers 16+, 2 people per jet ski.",
        descriptionFr: "Le long de la côte depuis Gustavia. Essence, guide, gilets et eau inclus. Pilote dès 16 ans, 2 personnes par jet ski.",
        price: null,
        priceType: "quote",
      },
    ],
  },
  {
    // no provider yet: the prices Alan gave
    name: null,
    offers: [
      {
        slug: "massage-60-min",
        category: "massage",
        name: "Massage, 60 min",
        nameFr: "Massage, 60 min",
        descriptionEn: null,
        descriptionFr: null,
        duration: "60 min",
        price: 160,
        priceType: "per_person",
      },
      {
        slug: "massage-90-min",
        category: "massage",
        name: "Massage, 90 min",
        nameFr: "Massage, 90 min",
        descriptionEn: null,
        descriptionFr: null,
        duration: "90 min",
        price: 220,
        priceType: "per_person",
      },
    ],
  },
];

async function seedActivityOffers() {
  const key = "activity_offers_batch_2026_10";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const categories = new Map((await prisma.activityCategory.findMany()).map((c) => [c.slug, c.id]));
  let n = 0;
  for (const { offers, ...p } of ACTIVITY_PARTNERS) {
    const partner = p.name
      ? await prisma.servicePartner.upsert({
          where: { kind_name: { kind: "activity", name: p.name } },
          update: {},
          create: { ...p, kind: "activity", currency: "EUR" },
        })
      : null;
    for (const [i, { category, ...o }] of offers.entries()) {
      const categoryId = categories.get(category);
      if (!categoryId || (await prisma.activity.findUnique({ where: { slug: o.slug } }))) continue;
      await prisma.activity.create({ data: { ...o, categoryId, partnerId: partner?.id ?? null, sortOrder: (i + 1) * 10 } });
      n++;
    }
  }
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  console.log(`Added ${n} activity offers`);
}

// Restaurants whose online booking link was filled before the admin did it
// automatically: offer them as "Réservation en ligne". Once per database, so
// a mode the owner picks later sticks.
async function backfillOnlineBooking() {
  const key = "map_batch_2026_10_online_booking";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const { count } = await prisma.mapPlace.updateMany({
    where: {
      category: "restaurant",
      AND: [{ bookingUrl: { not: null } }, { bookingUrl: { not: "" } }],
      // a plain `not: "direct"` would skip the null (not offered) ones
      OR: [{ bookingMode: null }, { bookingMode: { not: "direct" } }],
    },
    data: { bookingMode: "direct" },
  });
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  if (count) console.log(`Online booking set on ${count} restaurant(s)`);
}

// Contacts found for restaurants that had none (Alan OK'd the list on
// 2026-10-26). Once per database, and only into empty fields.
const RESTAURANT_CONTACTS = {
  "bar-oubli": { phone: "+590 590 27 70 06" },
  "eden-to-go": { phone: "+590 590 29 83 70" },
  "le-piment": { phone: "+590 590 27 53 88", email: "lepimentsbh@gmail.com", website: "https://lepimentbistro.com" },
  lucali: { phone: "+590 690 37 64 75", email: "hello@lucali-stbarth.com", website: "https://www.lucali-stbarth.com" },
  mapo: { phone: "+590 590 52 08 36" },
  sayolita: { phone: "+590 590 27 13 30" },
  "le-clandestin": { phone: "+590 590 27 66 89" },
};

async function applyRestaurantContacts() {
  const key = "map_batch_2026_10_restaurant_contacts";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  let n = 0;
  for (const [slug, fields] of Object.entries(RESTAURANT_CONTACTS)) {
    const row = await prisma.mapPlace.findUnique({ where: { slug } });
    if (!row) continue;
    const data = Object.fromEntries(Object.entries(fields).filter(([k]) => !row[k]));
    if (!Object.keys(data).length) continue;
    await prisma.mapPlace.update({ where: { slug }, data });
    n++;
  }
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
  if (n) console.log(`Contacts added to ${n} restaurant(s)`);
}

/**
 * Alan, 2026-10-26: back to the catalog as it was before the first St Barth
 * Provider sync (#45), with its photos — their server had blocked ours, so
 * the synced photos didn't load. Once: the 72 imported items get their
 * imported names, prices, categories and photos back (guestBookable kept),
 * the items the sync created are removed (stay lines keep their copy), and
 * the sync's state is cleared so a later run starts over from scratch.
 */
async function restorePreSyncExtras() {
  const key = "extras_restore_pre_sync_2026_10_26";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  const imported = await prisma.setting.findUnique({ where: { key: "extras_batch_sb_provider_2026_10" } });
  const partner = await prisma.servicePartner.findFirst({ where: { kind: "extras", name: "St Barth Provider" } });
  const synced = await prisma.setting.findUnique({ where: { key: "extras_sync_sb_provider" } });
  if (imported && partner && synced) {
    const rows = await prisma.extra.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } });
    // createMany kept the list order; its rows predate the import's setting
    const cutoff = new Date(imported.value).getTime() + 60_000;
    const legacy = rows.filter((x) => x.createdAt.getTime() <= cutoff);
    const added = rows.filter((x) => x.createdAt.getTime() > cutoff && x.externalRef);
    if (legacy.length !== SB_PROVIDER_EXTRAS.length) {
      console.warn(`Extras restore skipped: ${legacy.length} imported items found, ${SB_PROVIDER_EXTRAS.length} expected`);
      return;
    }
    await prisma.$transaction([
      ...legacy.map((x, i) => {
        const { imageUrl, ...item } = SB_PROVIDER_EXTRAS[i];
        return prisma.extra.update({
          where: { id: x.id },
          data: { ...item, imageUrl, unit: "night", sortOrder: 100 + i, isActive: true, externalRef: null },
        });
      }),
      prisma.extra.deleteMany({ where: { id: { in: added.map((x) => x.id) } } }),
      prisma.setting.delete({ where: { key: "extras_sync_sb_provider" } }),
    ]);
    console.log(`Extras restored: ${legacy.length} items as before the sync, ${added.length} synced items removed`);
  }
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
}

/** Alan, 2026-10-26: daily provider sync paused after the restore (Admin → Extras switch). Once. */
async function pauseExtrasSync() {
  const key = "extras_sync_paused_2026_10_26";
  if (await prisma.setting.findUnique({ where: { key } })) return;
  await prisma.setting.upsert({ where: { key: "extras_sync_auto" }, update: { value: "off" }, create: { key: "extras_sync_auto", value: "off" } });
  await prisma.setting.create({ data: { key, value: new Date().toISOString() } });
}

async function main() {
  await seedBase();
  await backfillConciergeRequests();
  await backfillOnlineBooking();
  await applyRestaurantContacts();
  await seedStBarthProviderExtras();
  await applyStBarthProviderPhotos();
  await restorePreSyncExtras();
  await pauseExtrasSync();
  await seedActivityCategories();
  await seedActivityOffers();
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
