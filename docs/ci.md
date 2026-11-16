# CI checks

Every pull request runs **Checks** (`.github/workflows/ci.yml`). Every push to
`main` runs the same checks first, and **Build & publish Docker image** only
publishes the image (which the unraid box then pulls) when all of them pass.

| Job | What it catches | Run it locally |
|---|---|---|
| Types, lint, unit tests | TypeScript errors, ESLint errors (warnings don't block), broken money rules (pricing, tourist tax, deposit, agency commission, payment summary), form guards | `npm run check` |
| Dependency audit | a new high/critical advisory in the production dependencies | `npm run check:audit` |
| Prisma schema safety | any schema change the boot's `prisma db push` would refuse or that loses data (drop, rename, type change, required column, `@unique` on an existing table — the 2026-10-26 outage); then rehearses the upgrade on a database holding the previous schema + demo data, and runs the seed twice | `DATABASE_URL=<empty throwaway db> npm run check:schema -- origin/main` |
| Image boots and serves pages | builds the real image, starts it on a database at the previous schema (its entrypoint upgrades it, as in production), then checks ~50 public (EN/FR) and admin pages, sitemap/robots/llms, the admin gate, legacy redirects, and that the server logged no errors | `BASE_URL=http://localhost:3000 node scripts/ci/smoke.mjs` |

## Known advisories

`.github/audit-allowlist.json` lists the advisories accepted for now, each with
a reason and a review date. Past that date the audit fails again, so they get
looked at. Remove an entry once its upgrade lands.

## E2E suites

Scenario suites (`e2e/`, Playwright) run against staging through **E2E
(staging)** (`.github/workflows/e2e.yml`): Actions → E2E (staging) → Run
workflow, with the staging URL and the suites (empty = all, `changed` = only
what the commit touches, via `e2e/select-suites.mjs`). It refuses the
production domain. Secrets: `STAGING_ADMIN_USER`, `STAGING_ADMIN_PASS`
(+ `STAGING_HTTP_USER`/`STAGING_HTTP_PASS` for basic auth).
