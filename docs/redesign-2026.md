# Redesign 2026 — public site and back office

The guest portal (`/account`, `/contracts/sign`) is deliberately left for its own pass.

## Direction: "golden hour editorial"

References gathered on Refero: Wallpaper* Projects and Aker (editorial luxury), onefinestay's
request-a-stay flow (booking), Cal.com / Fresha / time2book (back office).

- **Canvas**: warm paper `paper #fbf9f4`, `ivory #f4efe5`, ink text; one deep-sea chapter colour
  `sea #0e2a33` for the panels that carry money and invitations (rates, festive weeks, amenities).
- **Type**: Cormorant (monumental titles, lining figures), IBM Plex Mono for micro labels and
  numbers (`.ov-label`), Montserrat for body.
- **Gold** is reserved for the booking action, line icons and the hour; booking buttons are gold
  with ink lettering (white on gold failed contrast).
- **Structure**: hairline rules and ledgers instead of shadowed cards; capsule buttons.
- **Primitives** (`src/app/globals.css`, section "Redesign 2026"): `.ov-shell .ov-label .ov-h1/2/3
  .ov-intro .ov-body .ov-num .ov-rule .ov-btn(-gold|-ink|-line|-light|-glass) .ov-link .ov-photo
  .ov-glass-tile .ov-field .ov-prose`. Components: `src/components/site/ov/` (Masthead,
  EditorialHero + SectionHead, Testimonials).
- Legacy classes (`.btn-gold`, `.eyebrow`, `.field`…) are re-cut only inside `main:has(.ov-page)`,
  i.e. on public pages; the portal keeps the old look.
- **Admin**: the Tailwind slate scale and navy are re-mapped to warm neutrals inside `.admin-body`;
  lucide line icons replace the emojis; light sidebar; dashboard opens on "À traiter" and the next
  arrivals, then the season ledger and charts in gold / sea.

## Golden hour animation

Kept as is (shader over the real photo) with three realistic additions, all occluded by the
vegetation, pool and deck masks and lit by the time of day:

- a sailing yacht at anchor off Pointe Milou (bobs and swings; anchor light and warm portholes at
  night);
- a motor yacht crossing the bay at about 10 knots (wake, bow wave, navigation lights after dusk);
- a light aircraft taking off from Gustaf III, daylight only (SBH has no night flights), hidden
  behind the ridge, red beacon and tail strobe.

## Flow audit (66/66 checks, Playwright against a local build)

Public: home (film, sunset time, golden hour, booking links) · EN↔FR switch keeps the page · every
public page answers with a title (villa, tour, gallery, rates, booking, Pointe Milou, map, guide +
article, FAQ, reviews, contact, why book direct, legal, privacy, FR pages, guest login entry) ·
custom 404 · booking: dates → live quote → request enabled, bedrooms cap guests · contact form
validation · review rating · FAQ disclosure · gallery filter + viewer · map explorer · tour.
Mobile: menu sheet opens and navigates, tab bar, booking request sheet.

Admin: wrong password refused, login, every sidebar section answers, reservation editor opens,
new reservation form, dashboard blocks.

Found and fixed on the way: the designed 404 page never showed (unknown URLs fell through to the
framework's bare 404) → `[...rest]` catch-all; a dev-only hydration warning from the route
transition template.

Before/after screenshots: `docs/screenshots/redesign/`.
