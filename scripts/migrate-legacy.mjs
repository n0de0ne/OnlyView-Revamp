/**
 * Legacy data migration: copies the PHP site's data (lowercase tables in the
 * `public` schema) into the new app's tables (PascalCase, in the schema named
 * by DATABASE_URL's ?schema= parameter — default onlyview_app).
 *
 * READ-ONLY on the legacy tables. Never modifies or drops anything in public.
 *
 * Usage (inside the container or from a dev checkout):
 *   node scripts/migrate-legacy.mjs           # refuses if new tables have data
 *   node scripts/migrate-legacy.mjs --force   # migrate anyway (skips duplicates)
 *
 * Imports: agencies, clients, reservations (+ variable periods → ReservationPeriod,
 * payment flags → Payment ledger), contracts, promotions, expenses,
 * guestbook → Testimonial, admin users, and backfills loyalty points for
 * paid stays. Reservation/client ids are preserved.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");

const bool = (v) => v === true || v === 1 || v === "1" || v === "t";
const num = (v) => (v == null ? null : Number(v));
const date = (v) => (v == null ? null : new Date(v));
const round = (v) => Math.round(Number(v) || 0);

/**
 * The legacy schema is usually `public`, but PHP's connection could resolve
 * its unqualified table names elsewhere (search_path) — in production the
 * data was found in a schema named `onlyview`. Auto-detect: the non-app
 * schema whose `reservations` table has the most rows wins.
 * Override with LEGACY_SCHEMA=<name> if needed.
 */
let LEGACY = process.env.LEGACY_SCHEMA ?? null;

async function resolveLegacySchema() {
  if (LEGACY) {
    console.log(`Legacy schema (from LEGACY_SCHEMA): ${LEGACY}`);
    return;
  }
  const appSchema =
    /schema=([^&]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "onlyview_app";
  const candidates = await prisma.$queryRawUnsafe(
    `SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'reservations' AND table_schema <> $1
       AND table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema'`,
    appSchema
  );
  let best = null;
  let bestRows = -1;
  for (const c of candidates) {
    try {
      const n = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM "${c.table_schema}".reservations`
      );
      if (n[0].n > bestRows) {
        best = c.table_schema;
        bestRows = n[0].n;
      }
    } catch {
      /* unreadable schema — skip */
    }
  }
  LEGACY = best ?? "public";
  console.log(
    `Legacy schema: ${LEGACY}${bestRows >= 0 ? ` (${bestRows} reservations found)` : " (no reservations table found)"}`
  );
}

/** SELECT * from a legacy table; [] when the table doesn't exist. */
async function legacy(table) {
  try {
    return await prisma.$queryRawUnsafe(`SELECT * FROM "${LEGACY}".${table} ORDER BY id`);
  } catch (e) {
    console.log(`  (legacy table ${LEGACY}.${table} not found — skipped)`);
    return [];
  }
}

const report = {};
const count = (k, n = 1) => (report[k] = (report[k] ?? 0) + n);

async function main() {
  console.log("Legacy → new migration starting");
  console.log("Target schema:", /schema=([^&]+)/.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "(default)");
  await resolveLegacySchema();

  const existing = await prisma.reservation.count();
  if (existing > 0 && !FORCE) {
    console.error(
      `\nAbort: the new Reservation table already holds ${existing} rows.` +
        `\nRun with --force to migrate anyway (duplicates are skipped by natural keys).`
    );
    process.exit(1);
  }

  /* ── agencies ── */
  const agencies = await legacy("agencies");
  const agencyByName = new Map();
  for (const a of agencies) {
    const found =
      (await prisma.agency.findFirst({
        where: { name: { equals: a.name, mode: "insensitive" } },
      })) ??
      (await prisma.agency.create({
        data: {
          name: a.name,
          code: a.code ?? null,
          contactName: a.contact_name ?? null,
          email: a.email ?? null,
          phone: a.phone ?? null,
          commissionPercent: num(a.commission_percent) ?? 15,
          isActive: bool(a.is_active),
          notes: a.notes ?? null,
        },
      }));
    agencyByName.set(a.name.toLowerCase(), found);
    count("agencies");
  }

  /* ── clients (ids preserved) ── */
  const clients = await legacy("clients");
  for (const c of clients) {
    const email = c.email ? String(c.email).toLowerCase() : null;
    const dupe =
      (await prisma.client.findUnique({ where: { id: c.id } })) ??
      (email ? await prisma.client.findUnique({ where: { email } }) : null);
    if (dupe) {
      count("clients (skipped duplicates)");
      continue;
    }
    await prisma.client.create({
      data: {
        id: c.id,
        firstname: c.firstname ?? "—",
        lastname: c.lastname ?? "—",
        email,
        phone: c.phone ?? null,
        country: c.country ?? null,
        language: c.language ?? "en",
        address: c.address ?? null,
        city: c.city ?? null,
        postalCode: c.postal_code ?? null,
        notes: c.notes ?? null,
        discountPercent: num(c.discount_percent) ?? 0,
        discountReason: c.discount_reason ?? null,
        isVip: bool(c.is_vip),
        blacklisted: bool(c.blacklisted),
        blacklistReason: c.blacklist_reason ?? null,
        tags: c.tags ?? null,
        source: c.source ?? "direct",
        createdAt: date(c.created_at) ?? new Date(),
      },
    });
    count("clients");
  }

  /* ── reservations (ids preserved) ── */
  const reservations = await legacy("reservations");
  const STATUS_MAP = { libre: "blocked" };
  for (const r of reservations) {
    if (await prisma.reservation.findUnique({ where: { id: r.id } })) {
      count("reservations (skipped duplicates)");
      continue;
    }

    const priceHT = round(r.final_price);
    const noTax = bool(r.no_tax);
    const tax = noTax ? 0 : round(priceHT * 0.05);
    const priceTTC = priceHT + tax;
    const agencyRef = r.agency ? agencyByName.get(String(r.agency).toLowerCase()) : null;
    const clientId =
      r.client_id != null &&
      (await prisma.client.findUnique({ where: { id: r.client_id } }))
        ? r.client_id
        : null;

    // variable_rooms JSON → ReservationPeriod rows
    let periods = [];
    if (r.variable_rooms) {
      try {
        const parsed = JSON.parse(r.variable_rooms);
        if (Array.isArray(parsed)) {
          periods = parsed
            .filter((p) => p && (p.startDate ?? p.start) && (p.endDate ?? p.end))
            .map((p, i) => ({
              startDate: new Date((p.startDate ?? p.start) + "T00:00:00Z"),
              endDate: new Date((p.endDate ?? p.end) + "T00:00:00Z"),
              bedrooms: num(p.rooms ?? p.bedrooms) ?? 4,
              weeklyRate: num(p.weeklyRate ?? p.rate ?? p.customWeekly) || null,
              sortOrder: i,
            }));
        }
      } catch {
        count("reservations with unparseable variable_rooms");
      }
    }

    const depositReceived = bool(r.is_paid);
    const balanceReceived = bool(r.balance_received);
    const depositAmount = round(r.deposit) || round(priceTTC * 0.3);

    await prisma.reservation.create({
      data: {
        id: r.id,
        status: STATUS_MAP[r.status] ?? r.status ?? "option",
        startDate: date(r.start_date),
        endDate: date(r.end_date),
        clientId,
        clientName: r.client_name ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        bedrooms: num(r.bedrooms) ?? 4,
        guests: num(r.guests) ?? 8,
        agencyId: agencyRef?.id ?? null,
        agencyFeePercent: num(r.agency_fee) ?? agencyRef?.commissionPercent ?? 0,
        customWeeklyRate: num(r.custom_weekly_rate) || null,
        finalPriceOverride: priceHT || null, // legacy stored the billed HT — pin it
        priceHT,
        taxAmount: tax,
        priceTTC,
        discountPercent: num(r.discount_percent) ?? 0,
        offerOneRoom: bool(r.four_for_three),
        freeNights: num(r.free_nights) ?? 0,
        noTax,
        optionExpires: date(r.option_expires),
        depositAmount,
        depositReceived,
        balanceReceived,
        earlyCheckin: bool(r.early_checkin),
        arrivalTime: r.arrival_time ?? null,
        lateCheckout: bool(r.late_checkout),
        departureTime: r.departure_time ?? null,
        notes: r.notes ?? null,
        isArchived: bool(r.is_archived),
        archivedAt: date(r.archived_at),
        createdAt: date(r.created_at) ?? new Date(),
        periods: { create: periods },
      },
    });
    count("reservations");
    if (periods.length) count("variable periods", periods.length);

    // payment ledger from the legacy flags
    const paidAt = date(r.created_at) ?? date(r.start_date) ?? new Date();
    if (depositReceived && depositAmount > 0) {
      await prisma.payment.create({
        data: {
          reservationId: r.id,
          kind: "deposit",
          amount: depositAmount,
          method: "wire",
          receivedAt: paidAt,
          notes: "Migrated from legacy system",
        },
      });
      count("payments");
    }
    if (balanceReceived && priceTTC > 0) {
      const rest = priceTTC - (depositReceived ? depositAmount : 0);
      if (rest > 0) {
        await prisma.payment.create({
          data: {
            reservationId: r.id,
            kind: "balance",
            amount: rest,
            method: "wire",
            receivedAt: paidAt,
            notes: "Migrated from legacy system",
          },
        });
        count("payments");
      }
    }
  }

  /* ── contracts ── */
  const contracts = await legacy("contract_signatures");
  for (const c of contracts) {
    if (!(await prisma.reservation.findUnique({ where: { id: c.reservation_id } }))) continue;
    if (await prisma.contract.findUnique({ where: { token: c.token } })) continue;
    const r = await prisma.reservation.findUnique({ where: { id: c.reservation_id } });
    await prisma.contract.create({
      data: {
        reservationId: c.reservation_id,
        token: c.token,
        status: c.status === "signed" ? "signed" : c.status === "expired" ? "expired" : "void",
        language: c.lang === "fr" ? "fr" : "en",
        clientName: c.client_name ?? r.clientName ?? "—",
        clientEmail: c.client_email ?? null,
        totalPrice: r.priceTTC,
        depositAmount: round(r.priceTTC * 0.3),
        bodyHtml: `<p><em>Contract migrated from the legacy system.</em></p><p>Original status: ${c.status}${c.pdf_path ? ` · original PDF: ${c.pdf_path}` : ""}</p>`,
        signatureData: c.signature_data ?? null,
        signedAt: date(c.signed_at),
        signerIp: c.ip_address ?? null,
        pdfPath: c.pdf_path ?? null,
        viewCount: num(c.view_count) ?? 0,
        firstViewedAt: date(c.first_viewed_at),
        lastViewedAt: date(c.last_viewed_at),
        expiresAt: date(c.expires_at),
        createdAt: date(c.created_at) ?? new Date(),
      },
    });
    count("contracts");
  }

  /* ── promotions ── */
  for (const p of await legacy("promotions")) {
    const dupe = await prisma.promotion.findFirst({ where: { name: p.name } });
    if (dupe) continue;
    await prisma.promotion.create({
      data: {
        name: p.name,
        description: p.description ?? null,
        discountType: ["percent", "fixed", "free_nights"].includes(p.discount_type)
          ? p.discount_type
          : p.discount_type === "free_night"
            ? "free_nights"
            : "percent",
        discountValue: num(p.discount_value) ?? 0,
        minNights: num(p.min_nights),
        maxNights: num(p.max_nights),
        validFrom: date(p.valid_from),
        validUntil: date(p.valid_until),
        stayStartFrom: date(p.stay_start_from),
        stayStartUntil: date(p.stay_start_until),
        mustIncludeDate: date(p.must_include_date),
        promoCode: p.promo_code ?? p.code ?? null,
        isActive: bool(p.is_active),
        priority: num(p.priority) ?? 0,
        firstTimeOnly: bool(p.first_time_only),
        showOnWebsite: bool(p.show_on_website),
        maxUses: num(p.max_uses),
        usedCount: num(p.used_count) ?? 0,
        combinable: bool(p.combinable),
        notes: p.notes ?? null,
      },
    });
    count("promotions");
  }

  /* ── expenses ── */
  for (const e of await legacy("expenses")) {
    const dupe = await prisma.expense.findFirst({
      where: { date: date(e.date), amount: num(e.amount) ?? 0, category: e.category ?? "autre" },
    });
    if (dupe) continue;
    await prisma.expense.create({
      data: {
        date: date(e.date),
        category: e.category ?? "autre",
        amount: num(e.amount) ?? 0,
        description: e.description ?? null,
        notes: e.notes ?? null,
        isFixed: bool(e.is_fixed),
        frequency: e.frequency ?? null,
        endDate: date(e.end_date),
        paymentDay: num(e.payment_day) ?? 1,
      },
    });
    count("expenses");
  }

  /* ── guestbook → testimonials ── */
  for (const g of await legacy("guestbook")) {
    const dupe = await prisma.testimonial.findFirst({
      where: { name: g.name, message: g.message },
    });
    if (dupe) continue;
    await prisma.testimonial.create({
      data: {
        name: g.name,
        country: g.country ?? null,
        rating: num(g.rating) ?? 5,
        message: g.message,
        language: g.language ?? "en",
        isApproved: bool(g.is_approved),
        isFeatured: bool(g.is_featured),
        stayDate: date(g.stay_date),
        createdAt: date(g.created_at) ?? new Date(),
      },
    });
    count("testimonials");
  }

  /* ── admin accounts (bcrypt $2y$ hashes verify fine with bcryptjs) ──
     The PHP login used `admin_users`; a later `users` table also exists.
     Import both, admin_users first (those are the live PHP credentials). */
  const ROLE_MAP = {
    owner: "owner",
    admin: "owner",
    manager: "manager",
    editor: "manager",
    housekeeper: "viewer",
    viewer: "viewer",
  };
  const legacyUsers = [...(await legacy("admin_users")), ...(await legacy("users"))].filter(
    (u) => u && u.username && u.password_hash
  );
  for (const u of legacyUsers) {
    const username = String(u.username).toLowerCase();
    // email is optional in legacy admin_users but required+unique here
    const email = u.email
      ? String(u.email).toLowerCase()
      : `${username}@migrated.onlyviewstbarth.com`;
    const dupe = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (dupe) {
      // the seeded 'admin' account: adopt the legacy hash/role so the old
      // password keeps working
      if (dupe.username === username) {
        await prisma.user.update({
          where: { id: dupe.id },
          data: {
            passwordHash: u.password_hash,
            role: ROLE_MAP[u.role] ?? "viewer",
            isActive: bool(u.is_active),
            mustChangePassword: bool(u.must_change_password),
          },
        });
        count("users (updated seeded account)");
      }
      continue;
    }
    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: u.password_hash,
        firstname: u.firstname ?? null,
        lastname: u.lastname ?? null,
        role: ROLE_MAP[u.role] ?? "viewer",
        isActive: bool(u.is_active),
        mustChangePassword: bool(u.must_change_password),
        lastLogin: date(u.last_login),
        createdAt: date(u.created_at) ?? new Date(),
      },
    });
    count("users");
  }

  /* ── loyalty backfill for paid stays ── */
  const paidStays = await prisma.reservation.findMany({
    where: { status: "confirmed", balanceReceived: true, clientId: { not: null } },
  });
  for (const r of paidStays) {
    const points = Math.max(0, Math.floor(r.priceHT * 0.01));
    if (points === 0) continue;
    const already = await prisma.loyaltyTransaction.findFirst({
      where: { reservationId: r.id, kind: "earn" },
    });
    if (already) continue;
    const account = await prisma.loyaltyAccount.upsert({
      where: { clientId: r.clientId },
      create: { clientId: r.clientId },
      update: {},
    });
    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          kind: "earn",
          points,
          reason: `Stay ${r.startDate.toISOString().slice(0, 10)} → ${r.endDate.toISOString().slice(0, 10)} (migrated)`,
          reservationId: r.id,
          createdBy: "migration",
        },
      }),
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { increment: points }, lifetimePoints: { increment: points } },
      }),
    ]);
    count("loyalty earn transactions");
  }

  /* ── fix sequences after explicit-id inserts ── */
  for (const t of ["Client", "Reservation"]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM "${t}"), 1))`
    );
  }

  console.log("\nMigration complete:");
  for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${v}`);
  if (Object.keys(report).length === 0) console.log("  (nothing to migrate)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
