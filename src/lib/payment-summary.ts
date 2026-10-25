import { depositFor } from "./contract-content";
import { addDays, toISODate } from "./dates";

export interface RentPayment {
  kind: string;
  amount: number;
}

/**
 * What the villa collects for the rent. An agency pays it all in one go once
 * the stay is done, less its commission, and owes no deposit.
 */
export function rentDue(totalTTC: number, agencyFeePercent: number | null | undefined): number {
  const fee = Math.max(0, agencyFeePercent ?? 0);
  return Math.round((totalTTC - totalTTC * (fee / 100)) * 100) / 100;
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
  /** agency booking: no deposit, the agency pays the net after the stay */
  agency?: { feePercent: number; checkOut: string | Date } | null;
}) {
  const rent = p.payments.filter((x) => x.kind !== "extra");
  const ledger = rent.reduce((s, x) => s + (x.kind === "refund" ? -Math.abs(x.amount) : x.amount), 0);
  // the "Acompte reçu" box ticked without the payment in the ledger
  const flagOnly = p.depositReceived && !rent.some((x) => x.kind === "deposit") && p.depositAmount > 0;
  const received = Math.round((ledger + (flagOnly ? p.depositAmount : 0)) * 100) / 100;
  const agency = p.agency ?? null;
  const due = agency ? rentDue(p.totalTTC, agency.feePercent) : p.totalTTC;
  const depositRequired = agency ? 0 : depositFor(p.totalTTC);
  const remaining = Math.round((due - received) * 100) / 100;
  return {
    agency: agency != null,
    /** what the villa collects: the rent, or the agency's net */
    due,
    commission: Math.round((p.totalTTC - due) * 100) / 100,
    received,
    depositRequired,
    /** still to receive before the deposit is covered */
    depositShortfall: Math.max(0, depositRequired - received),
    remaining: Math.max(0, remaining),
    overpaid: Math.max(0, -remaining),
    balanceDueDate: agency ? toISODate(agency.checkOut) : addDays(toISODate(p.checkIn), -30),
    flagOnly,
  };
}

export type PaymentSummary = ReturnType<typeof paymentSummary>;
