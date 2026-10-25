import { depositFor } from "./contract-content";
import { addDays, toISODate } from "./dates";

export interface RentPayment {
  kind: string;
  amount: number;
}

/**
 * Where the rent stands — what was received, what the deposit now requires
 * and what is still owed. Counted like the contract: deposit / balance
 * payments and refunds from the ledger (extras are billed apart); a ticked
 * "Acompte reçu" with no deposit recorded counts the expected deposit.
 */
export function paymentSummary(p: {
  totalTTC: number;
  checkIn: string | Date;
  payments: RentPayment[];
  depositReceived: boolean;
  depositAmount: number;
}) {
  const rent = p.payments.filter((x) => x.kind !== "extra");
  const ledger = rent.reduce((s, x) => s + (x.kind === "refund" ? -Math.abs(x.amount) : x.amount), 0);
  // the "Acompte reçu" box ticked without the payment in the ledger
  const flagOnly = p.depositReceived && !rent.some((x) => x.kind === "deposit") && p.depositAmount > 0;
  const received = Math.round((ledger + (flagOnly ? p.depositAmount : 0)) * 100) / 100;
  const depositRequired = depositFor(p.totalTTC);
  const remaining = Math.round((p.totalTTC - received) * 100) / 100;
  return {
    received,
    depositRequired,
    /** still to receive before the deposit is covered */
    depositShortfall: Math.max(0, depositRequired - received),
    remaining: Math.max(0, remaining),
    overpaid: Math.max(0, -remaining),
    balanceDueDate: addDays(toISODate(p.checkIn), -30),
    flagOnly,
  };
}

export type PaymentSummary = ReturnType<typeof paymentSummary>;
