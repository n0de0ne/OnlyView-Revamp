# SEO / GEO playbook — Villa ONLY VIEW

What the site does on its own, what only the owner can do, and how to check
both. "GEO" = generative-engine optimisation: being the source ChatGPT,
Perplexity, Claude, Gemini and Google's AI answers quote when someone asks
about a villa in St Barth.

## 1. What is realistic

Three kinds of query, three different games:

| Query | Who ranks today | Our position |
|---|---|---|
| **Branded** — "Villa Only View", "Only View St Barth", "Only View Pointe Milou" | Us, if the entity is unambiguous everywhere | Must be #1 in every engine and every AI answer. This is the floor. |
| **Neighbourhood / long-tail** — "villa Pointe Milou", "4 bedroom villa St Barth direct owner", "villa St Barth heated pool sunset view", "villa near Christopher hotel" | Agencies (WIMCO, Sibarth, St Barth Properties) and listing sites | Winnable page by page: one house, precise facts, a real owner — exactly what answer engines prefer to quote. |
| **Head terms** — "villa St Barth", "St Barth luxury villa rental" | WIMCO, Sibarth, Eden Rock, Le Barthélemy — thousands of pages, decades of links | Not winnable head-on with one villa. We get *adjacent*: in the AI answer's list of examples, in "villas near Eden Rock", in the map pack. |

Eden Rock is a hotel, not a competitor for the same query; it is a
**landmark**, and the site now uses it as one ("8 minutes from Eden Rock").
That is how a single villa appears in Eden-Rock-adjacent searches without
pretending to be a hotel.

## 2. What the site does (shipped)

- **One canonical per language.** French pages used to declare the English
  URL as canonical — Google would have treated the whole French site as a
  duplicate and never indexed it. Fixed at the root (`altLanguages(path, locale)`).
- **Complete head on every page**: title ≤ 70 chars, description ≤ 165,
  canonical, `hreflang` en/fr/x-default, Open Graph (absolute `og:url`,
  1200×900 image), Twitter large card, `max-image-preview:large`.
- **One H1 per page** that names the thing: the home H1 is the wordmark plus a
  screen-reader/engine suffix ("luxury villa rental in Pointe Milou…").
- **No internal `/en/` links leaking** into the prerendered HTML (the language
  switch used to emit `/en/villa` and `/fr/en/villa` — both 404).
- **Structured data (JSON-LD)** linked into one graph by `@id`:
  `VacationRental` (the villa, with `hasMap`, `sameAs`, rating), `LodgingBusiness`,
  `Organization`, `Person` (Annie, the owner), `WebSite`, `AggregateOffer`,
  `FAQPage`, `Review`, `Article` (guides, with author/publisher/dates),
  `ImageGallery`, `ItemList`, `ContactPage`, `BreadcrumbList` everywhere.
- **Plain-text facts** on the home and villa pages (`KeyFacts`): the same
  facts as the JSON-LD, in visible text, because answer engines quote text.
- **Named neighbourhood**: the location page lists Le Christopher, Eden Rock,
  Nikki Beach, Le Sereno, Le Toiny, Gustavia, the airport with drive times.
- **Direct-vs-agency comparison table** on /why-book-direct — the page for
  "book St Barth villa direct" and the "vs agency" questions.
- **17 FAQ entries** phrased the way people ask ("Where exactly is…", "How much
  per week…", "How far from Eden Rock…", "Is it rented by the owner…").
- **`/llms.txt`**: a one-page factual brief for AI crawlers (llmstxt.org).
- **robots.txt** explicitly welcomes 21 crawlers by name (GPTBot,
  OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot,
  Bingbot, Amazonbot, Meta, CCBot…), keeps `/admin`, `/api`, `/account`,
  `/contracts` private.
- **Sitemap** with one entry per language, hreflang alternates, real
  `lastmod`, and image entries for the photo-led pages.
- **Redirects**: every legacy `.php` URL, `www` → apex, `/en/*` → `/*`.
- **Reviews page rendered per request**, so a fresh deploy never serves the
  empty build-time snapshot to a crawler.
- **Search Console / Bing tokens** are settings (Réglages → Contact), picked
  up without a deploy.

Check all of it against a running instance:

```bash
BASE_URL=https://onlyviewstbarth.com node scripts/seo-audit.mjs
```

## 3. What only the owner can do (in order of impact)

1. **Google Business Profile** — create/claim "Villa ONLY VIEW" as a *Vacation
   home rental* at the exact pin (`https://maps.app.goo.gl/9eV7KhFcF9AJdWeLA`),
   website = the site, phone = +590 690 39 90 47, photos from the gallery,
   and answer the Q&A. This is the single biggest lever for "villa Pointe
   Milou" and the map pack. Paste the profile URL into Réglages →
   *Fiche Google Business* so it enters the structured data as `sameAs`.
2. **Google Search Console + Bing Webmaster Tools** — verify the domain
   (paste the tokens in Réglages; they appear in `<head>` within the hour),
   submit `https://onlyviewstbarth.com/sitemap.xml`, and check *Pages* →
   *Not indexed* after a week. Bing feeds ChatGPT search and Copilot.
3. **Reviews, continuously** — ask every guest for a Google review *and* a
   review on the site (moderated in the admin). Ratings show in the
   `VacationRental` markup and are what AI answers cite for trust.
4. **Consistent name everywhere** — exactly "Villa ONLY VIEW" (or "Only View
   St Barth"), Pointe Milou, the same phone and email, on Instagram, Facebook,
   TripAdvisor, any listing (WIMCO, Airbnb, Vrbo…). Put each profile URL in
   Réglages → Contact; every one becomes a `sameAs` link that merges the
   entity for Google and the AI engines.
5. **Links from the listings you already have** — where an agency or a
   listing site lets you add "owner website", add it. A handful of real
   links from St Barth pages outweighs everything else off-site.
6. **Instagram / photos with the location tag** "Pointe Milou" and the villa
   name in the caption — a slow but steady branded signal.
7. **Keep the guide alive** — one honest article a season (a restaurant that
   opened, the ferry timetable, hurricane-season truth). Bump
   `CONTENT_UPDATED` in `src/lib/site-facts.ts` when the copy changes; it
   feeds `lastmod` and `dateModified`.
8. **Never let the reviews page or the calendar go stale** — engines
   re-crawl what changes.

## 4. How to know it works

- Search Console → *Performance*: branded queries should appear within
  2–4 weeks of verification; "Pointe Milou" queries within 2–3 months.
- Ask ChatGPT (with search), Perplexity and Google AI Mode:
  "Is Villa Only View in St Barth rented by the owner?", "villa in Pointe
  Milou with heated pool", "villas near Eden Rock St Barth". The first should
  quote the site outright; the others should list it among examples.
- `site:onlyviewstbarth.com` on Google and Bing → both languages indexed,
  no `/en/` or `?` URLs.
- Rich results test (search.google.com/test/rich-results) on `/`, `/faq`,
  `/reviews`, `/guide/best-beaches` → no errors.
