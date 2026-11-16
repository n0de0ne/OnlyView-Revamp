/**
 * Pricing engine — the money rules a guest sees on the booking page and the
 * owner signs in the contract. Values follow the default rate card.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, seasonForDate, clampBedrooms, DEFAULT_RATES } from "../../src/lib/pricing";

const week = { startDate: "2027-02-01", endDate: "2027-02-08", bedrooms: 4 };

test("seasons follow the default calendar, wrapping the new year", () => {
  assert.equal(seasonForDate("2027-02-01"), "winter");
  assert.equal(seasonForDate("2026-12-14"), "summer");
  assert.equal(seasonForDate("2026-12-15"), "winter");
  assert.equal(seasonForDate("2026-12-20"), "christmas");
  assert.equal(seasonForDate("2026-12-31"), "newyear");
  assert.equal(seasonForDate("2027-01-02"), "newyear");
  assert.equal(seasonForDate("2027-04-15"), "summer");
  assert.equal(seasonForDate("2027-07-14"), "lowSeason");
});

test("bedrooms are clamped to 2–4", () => {
  assert.equal(clampBedrooms(1), 2);
  assert.equal(clampBedrooms(9), 4);
});

test("a winter week: rent, 5% tourist tax, 30% deposit", () => {
  const q = computeQuote(week);
  assert.equal(q.nights, 7);
  assert.equal(q.minStayOk, true);
  assert.equal(q.subtotalHT, DEFAULT_RATES.winter[4]);
  assert.equal(q.taxAmount, 1075);
  assert.equal(q.totalTTC, 22575);
  assert.equal(q.depositAmount, Math.round(22575 * 0.3));
  assert.equal(q.totalTTC, q.finalHT + q.taxAmount);
});

test("tourist tax can be offered", () => {
  const q = computeQuote({ ...week, noTax: true });
  assert.equal(q.taxAmount, 0);
  assert.equal(q.totalTTC, q.finalHT);
});

test("'one bedroom offered' bills one bedroom less", () => {
  const q = computeQuote({ ...week, offerOneRoom: true });
  assert.equal(q.finalHT, DEFAULT_RATES.winter[3]);
  assert.equal(q.offerOneRoomDiscount, DEFAULT_RATES.winter[4] - DEFAULT_RATES.winter[3]);
});

test("a manual final price replaces the rent and the tax follows it", () => {
  const q = computeQuote({ ...week, finalPriceOverride: 20000 });
  assert.equal(q.overridden, true);
  assert.equal(q.finalHT, 20000);
  assert.equal(q.taxAmount, 1000);
  assert.equal(q.totalTTC, 21000);
});

test("agency commission is taken on the rent HT, never on the tax", () => {
  const q = computeQuote({ ...week, agencyFeePercent: 15 });
  assert.equal(q.agencyFeeAmount, 21500 * 0.15);
  assert.equal(q.netRevenue, 21500 - 3225);
  assert.equal(q.totalTTC, 22575);
});

test("Christmas is a flat weekly package with a 7-night minimum", () => {
  const q = computeQuote({ startDate: "2026-12-20", endDate: "2026-12-23", bedrooms: 4 });
  assert.equal(q.minStayRequired, 7);
  assert.equal(q.minStayOk, false);
  assert.equal(q.finalHT, DEFAULT_RATES.christmasWeekly);
});

test("stays shorter than the minimum are flagged", () => {
  const q = computeQuote({ startDate: "2027-07-01", endDate: "2027-07-03", bedrooms: 2 });
  assert.equal(q.minStayRequired, DEFAULT_RATES.minStay);
  assert.equal(q.minStayOk, false);
});

test("a percent rate period adjusts the season rate for its nights", () => {
  const rates = {
    ...DEFAULT_RATES,
    specials: [
      {
        id: 1, name: "Promo", start: "2027-02-01", end: "2027-02-07", mode: "percent" as const,
        weekly: {}, adjustPercent: -10, minStay: null, showOnWebsite: true,
      },
    ],
  };
  const q = computeQuote(week, rates);
  assert.equal(Math.round(q.subtotalHT), Math.round(DEFAULT_RATES.winter[4] * 0.9));
});
