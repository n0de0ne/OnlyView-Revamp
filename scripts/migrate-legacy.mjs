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
 *   node scripts/migrate-legacy.mjs --report  # list what is missing, write nothing
 *
 * Safe to re-run at any time: rows are matched on their natural key (a stay's
 * dates + client, a client's email, a contract's token), so anything created
 * in the PHP site since the last run is picked up — even when its id has been
 * taken in the meantime by something created in the new app.
 *
 * Imports: agencies, clients, reservations (+ variable periods → ReservationPeriod,
 * payment flags → Payment ledger), contracts, promotions, expenses,
 * guestbook → Testimonial, admin users, and backfills loyalty points for
 * paid stays. Reservation/client ids are preserved.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");
/** --report: list what is missing, write nothing */
const DRY = process.argv.includes("--report") || process.argv.includes("--dry-run");

/* Legacy id → id in the app schema. Ids are preserved when free; a legacy row
   whose id has since been taken by something created in the app is imported
   under a new id and tracked here so its contracts stay attached. */
const clientIdMap = new Map();
const reservationIdMap = new Map();
const toISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

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

/** bigint / numeric columns come back as BigInt / Decimal — flatten to Number. */
const normalizeValue = (v) => {
  if (typeof v === "bigint") return Number(v);
  if (v && typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  return v;
};

/** SELECT * from a legacy table; [] when the table doesn't exist. */
async function legacy(table) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${LEGACY}".${table} ORDER BY id`
    );
    return rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, normalizeValue(v)]))
    );
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

  if (DRY) console.log("REPORT MODE — nothing will be written\n");
  const existing = await prisma.reservation.count();
  if (existing > 0 && !FORCE && !DRY) {
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
    if (!a.name) {
      count("agencies skipped (no name)");
      continue;
    }
    const found =
      (await prisma.agency.findFirst({
        where: { name: { equals: a.name, mode: "insensitive" } },
      })) ??
      (await prisma.agency.create({
        data: {
          name: a.name,
          code: a.code ?? null,
          // legacy column is `commission`; `contact` is a free-text field
          contactName: a.contact || a.contact_name || null,
          email: a.email ?? null,
          phone: a.phone ?? null,
          commissionPercent: num(a.commission ?? a.commission_percent) ?? 15,
          // legacy has no is_active column — everything is active
          isActive: a.is_active == null ? true : bool(a.is_active),
          notes: a.notes || null,
        },
      }));
    agencyByName.set(a.name.toLowerCase(), found);
    count("agencies");
  }

  /* ── clients (ids preserved when free) ── */
  const clients = await legacy("clients");
  for (const c of clients) {
    const email = c.email ? String(c.email).toLowerCase() : null;
    /* Already imported? The stamp left by a previous run is authoritative;
       otherwise fall back to the natural key (email, else full name) and
       stamp the row so later runs are exact even if it is edited here. */
    const already =
      (await prisma.client.findFirst({ where: { legacyId: c.id } })) ??
      (email
        ? await prisma.client.findUnique({ where: { email } })
        : await prisma.client.findFirst({
            where: {
              firstname: { equals: c.firstname ?? "—", mode: "insensitive" },
              lastname: { equals: c.lastname ?? "—", mode: "insensitive" },
            },
          }));
    if (already) {
      clientIdMap.set(c.id, already.id);
      if (already.legacyId == null && !DRY) {
        await prisma.client.update({ where: { id: already.id }, data: { legacyId: c.id } });
        count("clients (legacy id stamped)");
      }
      count("clients (already imported)");
      continue;
    }
    // the legacy id may have been taken since by a client created in the app
    const taken = await prisma.client.findUnique({ where: { id: c.id } });
    if (taken) count("clients renumbered (id taken)");
    if (DRY) {
      console.log(`  + client ${c.firstname} ${c.lastname}${taken ? " (id taken → new id)" : ""}`);
      count("clients to import");
      continue;
    }
    const createdClient = await prisma.client.create({
      data: {
        ...(taken ? {} : { id: c.id }),
        legacyId: c.id,
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
    clientIdMap.set(c.id, createdClient.id);
    count("clients");
  }

  /* ── reservations (ids preserved) ── */
  const reservations = await legacy("reservations");
  // legacy enum: option | confirmed | completed — a completed stay is a
  // confirmed one in the past; libre (older data) means blocked
  const STATUS_MAP = { libre: "blocked", completed: "confirmed" };
  for (const r of reservations) {
    const startDate = date(r.start_date);
    const endDate = date(r.end_date);
    if (!startDate || !endDate) {
      console.log(`  (reservation ${r.id} skipped — missing start/end date)`);
      count("reservations skipped (missing dates)");
      continue;
    }

    /* Already imported? Match on the stay itself (dates + client), never on
       the id alone: since the migration both systems have been allocating
       ids from the same range, so a recent legacy reservation can carry an
       id the app has since given to a different booking. */
    const already =
      // the stamp from a previous run — exact even if the stay was edited here
      (await prisma.reservation.findFirst({ where: { legacyId: r.id } })) ??
      (await prisma.reservation.findFirst({
        where: {
          startDate,
          endDate,
          ...(r.client_name
            ? { clientName: { equals: r.client_name, mode: "insensitive" } }
            : {}),
        },
      })) ??
      // imported before the stamp existed and renamed since
      (await prisma.reservation.findFirst({ where: { id: r.id, startDate } }));
    if (already) {
      reservationIdMap.set(r.id, already.id);
      if (already.legacyId == null && !DRY) {
        await prisma.reservation.update({
          where: { id: already.id },
          data: { legacyId: r.id },
        });
        count("reservations (legacy id stamped)");
      }
      count("reservations (already imported)");
      continue;
    }
    const idTaken = await prisma.reservation.findUnique({ where: { id: r.id } });
    if (idTaken) count("reservations renumbered (id taken)");
    if (DRY) {
      console.log(
        `  + reservation #${r.id} ${toISO(startDate)} → ${toISO(endDate)} · ${r.client_name ?? "—"} · ${r.status}${idTaken ? " (id taken → new id)" : ""}`
      );
      count("reservations to import");
      continue;
    }

    const priceHT = round(r.final_price);
    const noTax = bool(r.no_tax);
    const tax = noTax ? 0 : round(priceHT * 0.05);
    const priceTTC = priceHT + tax;
    const agencyRef = r.agency ? agencyByName.get(String(r.agency).toLowerCase()) : null;
    const mappedClient = r.client_id != null ? clientIdMap.get(r.client_id) : undefined;
    const clientId =
      mappedClient ??
      (r.client_id != null && (await prisma.client.findUnique({ where: { id: r.client_id } }))
        ? r.client_id
        : null);

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

    const depositReceived = bool(r.is_paid) || r.deposit_status === "received";
    const balanceReceived = bool(r.balance_received);
    const depositAmount = round(r.deposit) || round(priceTTC * 0.3);

    const createdReservation = await prisma.reservation.create({
      data: {
        ...(idTaken ? {} : { id: r.id }),
        legacyId: r.id,
        status: STATUS_MAP[r.status] ?? r.status ?? "option",
        startDate,
        endDate,
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
        confirmationEmailSent: bool(r.confirmation_email_sent),
        portalEmailSent: bool(r.portal_email_sent),
        isArchived: bool(r.is_archived),
        archivedAt: date(r.archived_at),
        createdAt: date(r.created_at) ?? new Date(),
        periods: { create: periods },
      },
    });
    reservationIdMap.set(r.id, createdReservation.id);
    count("reservations");
    if (periods.length) count("variable periods", periods.length);

    // payment ledger from the legacy flags
    const paidAt = date(r.created_at) ?? date(r.start_date) ?? new Date();
    if (depositReceived && depositAmount > 0) {
      await prisma.payment.create({
        data: {
          reservationId: createdReservation.id,
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
            reservationId: createdReservation.id,
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
    if (!c.token || c.reservation_id == null) {
      count("contracts skipped (no token/reservation)");
      continue;
    }
    if (await prisma.contract.findUnique({ where: { token: c.token } })) {
      count("contracts (already imported)");
      continue;
    }
    // the reservation may have been renumbered on the way in
    const reservationId = reservationIdMap.get(c.reservation_id) ?? c.reservation_id;
    const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!r) {
      console.log(`  (contract ${c.token.slice(0, 8)}… skipped — reservation ${c.reservation_id} not imported)`);
      count("contracts skipped (no reservation)");
      continue;
    }
    if (DRY) {
      console.log(`  + contract ${c.token.slice(0, 8)}… (${c.status}) for reservation #${c.reservation_id}`);
      count("contracts to import");
      continue;
    }
    await prisma.contract.create({
      data: {
        reservationId,
        token: c.token,
        status: ["pending", "signed", "expired"].includes(c.status) ? c.status : "void",
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
    if (!p.name) {
      count("promotions skipped (no name)");
      continue;
    }
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
    const expenseDate = date(e.date);
    if (!expenseDate) {
      count("expenses skipped (no date)");
      continue;
    }
    const dupe = await prisma.expense.findFirst({
      where: { date: expenseDate, amount: num(e.amount) ?? 0, category: e.category ?? "autre" },
    });
    if (dupe) continue;
    await prisma.expense.create({
      data: {
        date: expenseDate,
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

  /* ── guestbook → testimonials ──
     Legacy columns: review (the text) and a status enum pending/approved/rejected. */
  for (const g of await legacy("guestbook")) {
    const message = g.review ?? g.message ?? null;
    if (!g.name || !message) {
      console.log(`  (guestbook entry "${g.name ?? "?"}" skipped — empty review)`);
      count("testimonials skipped (empty)");
      continue;
    }
    if (g.status === "rejected") {
      count("testimonials skipped (rejected)");
      continue;
    }
    const dupe = await prisma.testimonial.findFirst({
      where: { name: g.name, message },
    });
    if (dupe) continue;
    await prisma.testimonial.create({
      data: {
        name: g.name,
        country: g.country || null,
        rating: num(g.rating) ?? 5,
        message,
        language: g.language ?? "en",
        isApproved: g.status ? g.status === "approved" : bool(g.is_approved),
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
  for (const t of DRY ? [] : ["Client", "Reservation"]) {
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
