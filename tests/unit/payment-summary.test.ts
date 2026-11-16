/**
 * Where a reservation's rent stands: deposits for direct bookings, one net
 * payment after the stay for agencies (no deposit).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { agencyCommission, paymentSummary, rentDue } from "../../src/lib/payment-summary";

test("agency commission is a % of the rent HT, in cents", () => {
  assert.equal(agencyCommission(21500, 15), 3225);
  assert.equal(agencyCommission(10001, 12.5), 1250.13);
  assert.equal(agencyCommission(21500, null), 0);
  assert.equal(agencyCommission(21500, -5), 0);
});

test("rent due by an agency = total TTC minus its commission", () => {
  assert.equal(rentDue(22575, 21500, 15), 19350);
});

test("direct booking: 30% deposit, balance 30 days before arrival", () => {
  const s = paymentSummary({
    totalTTC: 22575, checkIn: "2027-02-01", payments: [], depositReceived: false, depositAmount: 6773,
  });
  assert.equal(s.agency, false);
  assert.equal(s.depositRequired, 6773);
  assert.equal(s.depositShortfall, 6773);
  assert.equal(s.remaining, 22575);
  assert.equal(s.balanceDueDate, "2027-01-02");
});

test("payments, refunds and the ticked deposit box add up; extras are billed apart", () => {
  const s = paymentSummary({
    totalTTC: 10000, checkIn: "2027-02-01", depositReceived: false, depositAmount: 3000,
    payments: [
      { kind: "deposit", amount: 3000 },
      { kind: "balance", amount: 7500 },
      { kind: "refund", amount: 300 },
      { kind: "extra", amount: 999 },
    ],
  });
  assert.equal(s.received, 10200);
  assert.equal(s.remaining, 0);
  assert.equal(s.overpaid, 200);

  const flag = paymentSummary({
    totalTTC: 10000, checkIn: "2027-02-01", payments: [], depositReceived: true, depositAmount: 3000,
  });
  assert.equal(flag.flagOnly, true);
  assert.equal(flag.received, 3000);
  assert.equal(flag.depositShortfall, 0);
});

test("agency booking: no deposit, net due on check-out", () => {
  const s = paymentSummary({
    totalTTC: 22575, checkIn: "2027-02-01", payments: [], depositReceived: false, depositAmount: 6773,
    agency: { feePercent: 15, checkOut: "2027-02-08", priceHT: 21500 },
  });
  assert.equal(s.agency, true);
  assert.equal(s.depositRequired, 0);
  assert.equal(s.due, 19350);
  assert.equal(s.commission, 3225);
  assert.equal(s.balanceDueDate, "2027-02-08");
});
