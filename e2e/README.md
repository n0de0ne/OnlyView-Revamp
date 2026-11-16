# End-to-end tests

Playwright tests that drive a **running** instance of the site (a staging, or
a local server) the way visitors, guests and the owner do. They are split in
**suites by area of the app**, so a change runs only what it touches.

```bash
E2E_BASE_URL=https://staging.example.com \
E2E_ADMIN_USER=e2e-owner E2E_ADMIN_PASS=… \
npm run e2e                 # everything (about 280 tests, four minutes)

npm run e2e:booking         # one suite
npm run e2e -- --project=contracts --project=guest-portal
npm run e2e:changed         # only the suites the current change calls for
npm run e2e:report          # open the HTML report of the last run
```

## Suites

| Suite | What it covers |
| --- | --- |
| `smoke` | The target is alive: home EN/FR, quote and availability APIs, back-office closed/open, the database writes, links point at this environment, emails are recorded. Runs with every selection. |
| `public` | Every public page in both languages, navigation, language switch, the home page and its golden hour animation, rates, contact form, reviews (moderation), 404 page, phone layout. |
| `seo` | Titles, descriptions, canonical/hreflang, JSON-LD, sitemap, robots.txt, llms.txt, legacy redirects, noindex rules. |
| `gallery` | Photo grid by room, viewer (keys, swipe, deep links), French, phone. |
| `map` | Island map: categories, search, place card, itinerary (routing service mocked), a place added in the back-office appears. |
| `booking` | Quote rules (tax, deposit, minimum stay, Christmas, promo codes), availability and iCal, the booking form (EN/FR/phone), the request in the owner's inbox, conversion to a stay. |
| `contracts` | Contract generation, signing page and signature pad, PDF, emails, amendments after a change of dates. |
| `guest-portal` | Access (owner's link, emailed link, isolation between guests, sign-out), arrival details, change-of-dates requests (approve / reject / withdraw), Wi-Fi and safe card. |
| `concierge-extras` | Extras catalog and requests, concierge requests (table, boat, chef, activity), the owner's answers and emails, catalog management. |
| `analytics` | A visit is recorded with its pages and source; the team, opted-out visitors and robots are not; crawler log; report API and screen. |
| `admin-core` | Sign-in, forced password change, sign-out, every data route closed to visitors, every screen opens, roles (viewer / manager / owner), accounts, audit trail. |
| `admin-reservations` | Stays: pricing options, date clashes, payments, agencies (commission on the rent before tax, no deposit), archive, clients, the list / editor / calendar screens. |
| `admin-finance` | Season figures (revenue, tax, nights, commissions, cash-in), expenses and recurring charges, rates by date, promotions, settings. |
| `admin-content` | Site texts (an edit shows publicly, then is put back), guide articles, photos, map editor, owner's tools. |

Each suite is a folder here and a Playwright project of the same name
(`playwright.config.ts`).

### Running only what a change touches

`e2e/suites.json` maps source files to suites. `npm run e2e:changed` compares
the branch with `origin/main` (plus uncommitted work) and runs the matching
suites; shared files (schema, middleware, mailer…) run everything, docs run
nothing.

```bash
node e2e/select-suites.mjs --why                 # which suites, and because of which files
node e2e/select-suites.mjs --base=some-ref --json
node e2e/select-suites.mjs src/lib/pricing.ts    # for given files
npm run e2e:changed -- -- --reporter=line        # options after "--" go to Playwright
```

In a CI step: `npx playwright test $(node e2e/select-suites.mjs)`.
When a new source file is added, list it in `suites.json`; until then it runs
every suite (nothing is skipped silently).

## Settings

| Variable | Default | |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | The site to test. Never hard-coded anywhere else. |
| `E2E_ADMIN_USER` | `admin` | An **owner** account of the back-office (username or email). |
| `E2E_ADMIN_PASS` | — | Its password. Without it the back-office tests are skipped and the public read-only ones still run. |
| `E2E_HTTP_USER` / `E2E_HTTP_PASS` | — | If the staging sits behind HTTP basic auth. |
| `E2E_WORKERS` | `2` | Test files run side by side. |
| `E2E_PROD_HOSTS` | `onlyviewstbarth.com,www.onlyviewstbarth.com` | Hosts treated as the live site. |

## Preparing the staging

1. **Its own database** (a copy of production is fine). The tests create and
   delete records; they never touch a record they did not create.
2. **A dedicated owner account**, e.g. `e2e-owner`: create it in
   Utilisateurs, sign in once by hand and choose its password (a new account
   must change its first password before anything else works).
3. **`SITE_URL` set to the staging address.** Links in emails and contracts
   are built from it; `smoke` fails if they point elsewhere.
4. **`PUBLIC_FORMS_HOURLY_LIMIT=1000`** in the staging environment. The public
   forms accept a handful of sends per hour and per address; without this a
   second run within the hour skips the form tests (they are skipped with a
   note, not failed). Never set it in production.
5. **No real mailbox behind test emails.** Guests created by the tests use
   `…@example.com` addresses, which nobody receives. Emails to the *owner*
   (new request, guest update) go to the address set in Réglages: on a staging
   with SMTP configured, point it at a test mailbox or leave SMTP unset (emails
   are then logged as "queued", which is all the tests need).
6. Reminders are never triggered by the tests (only their preview is read).

Locally:

```bash
service postgresql start && npm run setup && npm run build
PUBLIC_FORMS_HOURLY_LIMIT=1000 REMINDERS_SCHEDULER=off EXTRAS_SYNC=off npm start &
E2E_ADMIN_PASS=… npm run e2e
```

## What the tests leave behind

- Everything a test creates is named **`E2E …`** (clients `E2E Guest …` with
  `e2e-…@example.com`, accounts and guide articles `e2e-…`) and is deleted when
  the test ends. A final sweep removes what an interrupted run left;
  `npm run e2e:cleanup` runs that sweep alone.
- Test stays are booked **far in the future** (more than a year ahead; the
  finance figures are checked on a season eight years ahead), each test file
  in its own stretch of the calendar, so suites never fight for dates and never
  meet a real booking. The few tests that need near dates look for a free gap
  and skip themselves if there is none.
- Three tests change something that already exists and put it back in a
  `finally`: one sentence of the home page copy, one photo's "published"
  switch, and the Wi-Fi settings (only when none are set).
- Analytics: test visits carry the campaign tag `e2e-…` and stay in the
  staging's statistics.
- **Against the live site nothing is written**: every test that creates data
  skips itself when `E2E_BASE_URL` is one of `E2E_PROD_HOSTS`. Only the
  read-only tests run there.

## Writing tests

- Import `test` / `expect` from `e2e/support/fixtures`. Fixtures: `admin`
  (back-office API as the owner), `visitor` (anonymous API), `scratch` (creates
  clients, stays, extras… and removes them), and a `page` that fails the test
  on any uncaught script error or 5xx from the site.
- Dates: `scratch.reservation("<lane>")` picks free dates in the lane of the
  spec file (`e2e/support/dates.ts`); add a lane for a new file.
- The site copy is editable in the back-office, so tests assert **structure
  and data** (ids, roles, amounts, what the API stored), not wording.
- The tests rely on a few stable hooks in the markup. Keep them when
  redesigning a page: `#bk-start #bk-end #bk-bed #bk-guests #bk-name #bk-email
  #bk-phone #bk-msg` (booking form), `#c-name #c-email #c-msg` (contact),
  `#r-name #r-country #r-msg` (review), `#sig-name` (contract signature),
  `#g-email` (guest sign-in), `#golden-hour-time` (golden hour slider),
  `#stay-info`, `#concierge-requests-<id>`, the portal fields
  `#arrivalFlight-<id>`…, `#dc-start-<id> #dc-end-<id> #dc-msg-<id>`,
  `#cg-date-<id> #cg-guests-<id> #cg-notes-<id>`, `#q-… #n-… #serviceDate-…`
  (extras), `#username #password` (back-office sign-in), `[data-photo]` and
  `[data-chrome]` (gallery), and `main h1` on every screen.
- `npm run e2e:types` type-checks the tests (they are outside the app's
  `tsconfig.json`, so `next build` ignores them).

## When a test fails

`npm run e2e:report` opens the report: each failure has a screenshot and a
trace (`npx playwright show-trace e2e/.results/<test>/trace.zip`) showing every
step, request and console message.
