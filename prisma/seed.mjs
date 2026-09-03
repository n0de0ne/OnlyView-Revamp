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
  listing_urls: "",
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

async function main() {
  await seedBase();
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
