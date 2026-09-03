# Villa ONLY VIEW — Next.js Revamp

Modern rebuild of [onlyviewstbarth.com](https://onlyviewstbarth.com) — the rental site for Villa ONLY VIEW (Pointe Milou, Saint-Barthélemy) — replacing the legacy PHP stack with a single **Next.js 15** application: public marketing site, booking engine, guest portal with loyalty program, and a full owner back-office.

## Quick start

```bash
npm install
# a PostgreSQL to point DATABASE_URL at — any of:
docker run -d --name ov-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
npm run setup          # creates the app schema + seeds rates/admin/photos
npm run dev            # http://localhost:3000
```

Want a playground with demo reservations, clients, expenses and loyalty data?

```bash
SEED_DEMO=1 npm run setup
```

**Admin** → `http://localhost:3000/admin` — user `admin`, password `onlyview2026`
(you are forced to change it at first login; set `SEED_ADMIN_PASSWORD` to seed a different one).

## What's inside

### Public site (`/`, `/fr` — full EN/FR i18n)
| Feature | Where |
|---|---|
| Presentation with video hero, spaces, amenities, testimonials | `/` |
| Villa deep-dive (rooms, key figures) | `/villa` |
| **Immersive room-by-room virtual tour** (scroll-driven) | `/tour` |
| **Interactive gallery** — category filters, keyboard/swipe lightbox | `/gallery` |
| Transparent rates & seasons table (driven by admin settings) | `/rates` |
| **Booking module** — live availability calendar, instant quote (seasons, holiday packages, promo codes), request form | `/booking` |
| **Guest portal** — passwordless magic-link login, reservations, payment status, contract signing (loyalty panel when the programme is on) | `/account` |
| Online **contract e-signature** (draw + type-to-confirm) & PDF download | `/contracts/sign/[token]` |
| **Interactive island map** — 15 beaches, 40+ restaurants, supermarkets, bakeries, pharmacies, airport/ferry/gas, sports, each with its drive time and a road itinerary from the villa (via-points for St Barth's tricky lanes, walk-in beaches drawn as a dashed leg), Google Maps / Waze hand-off, search, category filters, a text directory + `TouristDestination` JSON-LD for SEO/GEO | `/map` |
| **Golden hour** — a WebGL sky-and-sea of the view from the terrace (three.js / react-three-fiber / drei), the sun dragged from afternoon to the first stars | `/`, `/location` |
| Reviews with moderation, St Barth guide hub, FAQ, location, why-book-direct, legal/privacy | … |

**SEO / GEO:** one canonical per language + `hreflang` en/fr/x-default, complete Open Graph / Twitter cards on every page, one H1 per page, a linked JSON-LD graph (`VacationRental`, `LodgingBusiness`, `Organization`, `Person` owner, `WebSite`, `AggregateOffer`, `FAQPage`, `Review`, `Article`, `ImageGallery`, `ContactPage`, `BreadcrumbList`), plain-text key facts and a named-neighbourhood section that answer engines can quote, `/llms.txt`, a robots.txt that welcomes 21 AI crawlers by name, a bilingual image sitemap with real `lastmod`, 301s from every legacy `.php` URL and from `www`. `scripts/seo-audit.mjs` crawls a running instance and fails on any regression; `docs/seo-playbook.md` is the off-site checklist (Google Business Profile, Search Console, reviews, `sameAs` profiles).

### Admin (`/admin` — role-based: owner / manager / viewer)

Everything is reported by **season — 1 September → 31 August** (a season is named
after the year it opens: *2025 – 2026* runs Sep 2025 → Aug 2026), so a winter
high season is never split across two reporting periods. The dashboard,
calendar, finance and reservation list all share the same season picker.

Editors open as **modals over the page you were on** (Next.js intercepting
routes): clicking a stay in the calendar, list, dashboard or a contract opens it
as an overlay, `Esc` closes it and you are back where you were with filters and
scroll intact — while the URL still updates, so a refresh or a shared link
renders the full page.

- **Dashboard** — KPI cards, revenue & occupancy **graphs**, booking-source pie, expiring options, arrivals (Recharts).
- **Calendar** — 12-month season view (September → August), colored spans, back-to-back split days, click-to-create.
- **Reservations** — list + full editor with *all* the legacy PHP options:
  statuses (option 🟠 / confirmed 🔴 — the two the business uses), option expiry, client autocomplete + VIP/blacklist badges, bedrooms/guests, agency & commission %, **variable periods (multi-pricing: different bedrooms and custom weekly rate per period)**, custom weekly rate, manual final price, discount %, *offer one bedroom*, free nights, offered tax, live season breakdown (incl. Christmas/New Year 7-night packages), revenue preview (HT/TTC/net), **profitability analysis** (cleaning + fixed charges, EUR), auto 30% deposit, payment ledger, early check-in / late check-out times.
- **Contracts** — one-click EN/FR generation from the reservation (total = TTC, deposit 30 %, balance 30 days before arrival), signature link, email sending, view tracking, e-signature (draw + type-to-confirm), PDF (pdf-lib) with embedded signature and an **electronic-signature certification** (date/time, signatory, IP); on signing the client receives the signed PDF and the owner a detailed notification. Void/extend.
- **Emails** — booking-request acknowledgement + owner alert, contract signature request, signed-contract copies, guest-portal link, and the **booking confirmation** (opt-in checkbox when confirming a stay, or "send now"/"resend" in the editor). Without SMTP every message is kept in the admin **Email log** as *queued*.
- **Finance** (owner) — expenses with **recurring fixed costs** (monthly/quarterly/…), P&L per season: accrual revenue vs cash-in vs expenses, commissions, collected tax.
- **Requests** — website booking-request inbox → one-click convert to option/confirmed reservation (creates/links the client).
- **Clients** — CRM with stats, standing discounts, VIP, blacklist, tags.
- **Loyalty** *(switched off by default)* — automatic earning (1 pt/$100 paid, configurable), tiers (Silver/Gold/Platinum), manual adjustments. The whole programme is behind the `loyalty_enabled` setting (Réglages → Programme de fidélité): at `0` nothing is shown or credited anywhere — site copy, guest portal, admin menu and API — and `1` brings it all back without a deploy.
- **Agencies / Promotions** — CRUD, commission stats, promo-code rules (nights, windows, must-include date, usage caps).
- **Site & content** — photo manager (upload → auto WebP/resize), review moderation, email log.
- **Island map** — the pins of `/map`: add/edit/hide places by category, drop the pin on a map, add the via-points the drive from the villa must follow (drag to adjust), flag "park here, walk the rest", and test the itinerary against the router before saving.
- **Settings** (owner) — all rates & seasons, tax, min-stay, deposit %, loyalty config, profitability constants, bank details for contracts, contact info.
- **Users** (owner) — multiple accounts with roles, forced password change, self-lockout protection, audit log on every action.

### Business rules (ported 1:1 from the PHP `PricingService` + admin)
- Reporting season: 1 September → 31 August (`src/lib/dates.ts`).
- Rate seasons: Winter Dec 15–Apr 14 · Summer(low) Jun 1–Aug 31 · Mid-season otherwise.
- Christmas (Dec 20–26) & New Year (Dec 27–Jan 2): flat weekly packages, billed min. 7 nights.
- Weekly rates per bedrooms-in-use (2/3/4) — all editable in Settings.
- 5% tourist tax, 30% deposit, balance 30 days before arrival.
- Checkout day is bookable for the next arrival (half-day calendar rendering).

### Motion

Inertial scrolling (Lenis, driven by GSAP's ticker and synced with ScrollTrigger), scroll reveals that never hide content from crawlers or no-script readers, word-by-word heading reveals in pure CSS, count-up figures (GSAP), magnetic buttons and tilting cards (Framer Motion), route transitions that skip the first paint, parallax photos, and the golden-hour WebGL scene that mounts only near the viewport and renders only while visible. Everything respects `prefers-reduced-motion`.

## Stack

Next.js 15 (App Router, TS) · Tailwind CSS 4 · Prisma + PostgreSQL · Framer Motion · GSAP · Lenis · three.js / react-three-fiber / drei · Leaflet · Recharts · pdf-lib · nodemailer · zod · bcryptjs — no auth SaaS, no CMS SaaS: sessions are httpOnly-cookie + hashed DB tokens.

```
src/
  app/(site)/[locale]/…    public site (en at /, fr at /fr)
  app/(admin)/admin/…      back-office (French UI, like the original)
  app/api/…                public + admin APIs
  lib/pricing.ts           the quote engine (shared server/client)
  lib/contract-*.ts        contract content EN/FR + PDF renderer
  lib/…                    auth, guest-auth, loyalty, stats, mailer, seo, i18n
prisma/schema.prisma       full data model  ·  prisma/seed.mjs
scripts/migrate-legacy.mjs legacy PHP data → new schema importer
scripts/prepare-media.ts   photo pipeline from the legacy repo
```

## SEO audit

```bash
BASE_URL=http://localhost:3000 node scripts/seo-audit.mjs
```

Crawls the sitemap and every internal link in both languages and checks
what engines read: status, `lang`, title/description length and uniqueness,
one H1, canonical + hreflang, Open Graph / Twitter, JSON-LD validity and the
expected types per page, image alt text, thin pages, broken links, noindex
leaks, sitemap consistency, robots.txt and llms.txt. Exit code 1 on any
failure. The owner-side checklist is in [`docs/seo-playbook.md`](docs/seo-playbook.md).

## Mobile audit

```bash
BASE_URL=http://localhost:3000 ADMIN_USER=admin ADMIN_PASS=… node scripts/mobile-audit.mjs
```

Renders every public page (both languages) and the main admin screens at
390×844 in Chromium and reports what breaks on a phone: horizontal
overflow and the elements causing it, tap targets under 40 px, text under
13 px, inputs under 16 px (iOS zooms into those), fixed elements covering
each other — with a screenshot of each page under `./mobile-audit/`.
Exit code 1 on any overflow.

## Smoke test

`scripts/e2e-audit.mjs` drives the core back-office flows against a running
instance — agencies, clients, reservations (pricing, conflicts, seasons),
availability + iCal, payments + loyalty, contracts (generate → sign → PDF),
expenses, stats cross-checks and every email path — creating its own data in
2027 and deleting it afterwards:

```bash
BASE_URL=http://localhost:3000 ADMIN_USER=admin ADMIN_PASS=… node scripts/e2e-audit.mjs
```

## Configuration

Copy `.env.example` → `.env` and fill what you need:

- `DATABASE_URL` — PostgreSQL connection string. **The app manages only its own schema namespace** (`?schema=onlyview_app`, appended automatically when missing), so it can safely share the legacy PHP site's database: the old lowercase tables in `public` are never read, altered, or dropped by the app.
- `SMTP_*` — without SMTP nothing is lost: every outgoing email is stored in the admin **Email log** with status *queued*.
- `SITE_URL` — the address the site is reached at. Every absolute link the server hands out (contract and guest-portal links, emails, redirects, canonicals) is built from it, never from the incoming request, so a reverse proxy that forwards its own upstream address as `Host` cannot leak `0.0.0.0:3000` into a link. `NEXT_PUBLIC_SITE_URL` is still read as a fallback, but it is inlined when the image is built — set `SITE_URL` on the container.
- `ADMIN_NOTIFY_EMAIL`, `ICAL_TOKEN` (private calendar feed `/api/ical?token=…`; public feed is anonymized).

## Deploying

### Docker (recommended)

Every push to the main branch builds and publishes
`ghcr.io/n0de0ne/onlyview-revamp` via GitHub Actions
(`.github/workflows/docker.yml`).

```bash
docker run -d --name onlyview \
  -p 3000:3000 \
  -v /path/to/appdata:/data \
  ghcr.io/n0de0ne/onlyview-revamp:latest
```

Required: `-e DATABASE_URL=postgresql://user:pass@host:5432/onlyview` (a
`?schema=onlyview_app` namespace is enforced so the app never touches other
tables in that database — it can safely share the legacy PHP site's DB).
First boot creates the app schema, seeds the default rates and the admin
account, and persists photo uploads in `/data/uploads`. Optional env vars:
`SEED_DEMO=1` (demo dataset on an empty database), `SEED_ADMIN_PASSWORD`,
`SMTP_*`, `ADMIN_NOTIFY_EMAIL`, `ICAL_TOKEN`, `PUID`/`PGID`.

### Migrating the legacy PHP data

With `DATABASE_URL` pointing at the same database as the old site:

```bash
docker exec -it onlyview node scripts/migrate-legacy.mjs
```

Read-only on the legacy tables; imports agencies, clients, reservations
(incl. variable periods and payment history), contracts, promotions,
expenses, guestbook reviews and admin accounts (old passwords keep
working), then backfills loyalty points for paid stays.

**Safe to re-run at any time** to pick up whatever the PHP site has
recorded since — including rows whose id the new app has meanwhile given
to something else, which are imported under a fresh id with their
contracts following them. Every imported row is stamped with its
`legacyId`, so later runs are exact even after the stay is edited here.
Check first without writing anything:

```bash
docker exec -it onlyview node scripts/migrate-legacy.mjs --report   # what is missing
docker exec -it onlyview node scripts/migrate-legacy.mjs --force    # import it
```

The report also names the legacy schema it read and, when several look like
one, every candidate with its reservation count. Contracts pointing at a
reservation that no longer exists in the legacy database are counted as
*orphans* and left out: the PHP admin joins `reservations` everywhere it shows
a contract, so those rows are invisible there too.

> **Note:** the GHCR package is private by default. After the first workflow
> run, open the package on GitHub (Packages → onlyview-revamp → Package
> settings) and set visibility to *Public* — otherwise Docker/Unraid needs a
> `docker login ghcr.io` with a token first.

### Unraid

An Unraid template ships in [`unraid/onlyview.xml`](unraid/onlyview.xml).
Install it with **Docker → Add Container → Template repositories** by adding
this repo URL, or copy the XML to
`/boot/config/plugins/dockerMan/templates-user/` on your flash drive and pick
*OnlyView* from the template dropdown. It maps port `3000`, stores everything
in `/mnt/user/appdata/onlyview`, and exposes the SMTP/loyalty/token settings
as container variables. WebUI → the site; `/admin` → the back-office.

### Bare Node

`npm run build && npm start` behind any Node host. Two notes:

1. **Photo uploads** from the admin are written to `public/media/photos/uploads/` — perfect on a VPS/Docker/persistent disk. On serverless hosts (Vercel …) the filesystem is ephemeral: keep managing photos via the repo, or wire the upload route to object storage (S3/R2).
2. A reachable PostgreSQL is required (`DATABASE_URL`).

## Legacy migration notes

- Every old `.php` URL 301-redirects to its new home (`next.config.ts`).
- `scripts/prepare-media.ts` curates/re-encodes photos from the old repo (`../OnlyView`) and writes `src/data/photos.json`, which seeds the Photo table.
- Not carried over (by design, out of scope of the revamp): the concierge marketplace (restaurants/chefs/boats/taxis directories), visitor-analytics warehouse, PWA service workers, and the 7-language dictionary (EN/FR shipped; the i18n layer is one file per language, `src/lib/i18n/`, typed against the EN dictionary — adding es/pt/de/it/ru back is mechanical).
