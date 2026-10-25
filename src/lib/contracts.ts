import "server-only";
import { randomBytes } from "node:crypto";
import type { Client, Contract, DateChange, Payment, Reservation } from "@prisma/client";
import { prisma } from "./db";
import { buildContract, contractToHtml, type ContractParams } from "./contract-content";
import { getRateConfig, getSettings } from "./settings";
import { formatDate, nightsBetween, toISODate } from "./dates";
import { sendMail } from "./mailer";
import { emailButton, emailTexts, renderEmail } from "./email-templates";
import { SITE_URL } from "./seo";
import { getContent } from "./site-content";

/** Released dates an amendment must mention. */
export interface ReleasedDates {
  startDate: string;
  endDate: string;
  previousTotal: number | null;
  previousSignedOn: string | null;
  /** the date changes the amendment will settle */
  changeIds: number[];
}

/**
 * Money received toward the rent, oldest first: deposit / balance payments
 * and refunds from the ledger (extras are billed apart). A ticked "Acompte
 * reçu" with no deposit recorded counts the expected deposit, like the editor.
 */
export function rentReceived(
  r: Pick<Reservation, "depositReceived" | "depositAmount">,
  payments: Pick<Payment, "kind" | "amount" | "receivedAt">[]
): Array<{ date: string | null; amount: number }> {
  const lines = payments
    .filter((p) => p.kind !== "extra")
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map((p) => ({
      date: toISODate(p.receivedAt) as string | null,
      amount: p.kind === "refund" ? -Math.abs(p.amount) : p.amount,
    }));
  const depositPaid = payments.some((p) => p.kind === "deposit");
  if (r.depositReceived && !depositPaid && r.depositAmount > 0) {
    lines.unshift({ date: null, amount: r.depositAmount });
  }
  return lines;
}

/** Dates and price stored on a contract when it was issued (null for contracts issued before snapshots). */
export function contractTerms(c: Pick<Contract, "termsJson">): ContractParams | null {
  if (!c.termsJson) return null;
  try {
    return JSON.parse(c.termsJson) as ContractParams;
  } catch {
    return null;
  }
}

/**
 * Something already binds the guest to the stay's dates: a contract that was
 * issued (signed, awaiting signature or expired — only drafts replaced before
 * being sent are void) or money received toward the rent.
 */
export function hasPriorAgreement(r: {
  depositReceived: boolean;
  contracts: Pick<Contract, "status">[];
  payments: Pick<Payment, "kind">[];
}): boolean {
  return (
    r.contracts.some((c) => c.status !== "void") ||
    r.payments.some((p) => p.kind !== "extra") ||
    r.depositReceived
  );
}

/**
 * The dates the next contract must release, or null when it is a plain
 * contract. Any change of dates on a stay that was already contracted or
 * paid for gives an amendment. The dates released are those of the signed
 * agreement (from its snapshot; for one issued before snapshots, the earliest
 * change not yet covered by an amendment); with nothing signed, the earliest
 * such change, else the latest issued contract for other dates.
 */
export function detectReleasedDates(
  r: Pick<Reservation, "startDate" | "endDate" | "depositReceived"> & {
    contracts: Pick<Contract, "status" | "signedAt" | "totalPrice" | "termsJson" | "createdAt">[];
    payments: Pick<Payment, "kind">[];
    dateChanges: Pick<DateChange, "id" | "status" | "contractId" | "fromStart" | "fromEnd" | "previousTTC" | "createdAt">[];
  }
): ReleasedDates | null {
  if (!hasPriorAgreement(r)) return null;
  const issued = r.contracts
    .filter((c) => c.status !== "void")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const signed = issued.find((c) => c.status === "signed");
  const start = toISODate(r.startDate);
  const end = toISODate(r.endDate);
  const open = r.dateChanges
    .filter((d) => d.status === "approved" && d.contractId == null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  type Prev = { start: string; end: string; total: number | null } | null;
  // what a contract says was agreed before the stay's current dates:
  // undefined when it has no snapshot, null when it is for the current
  // dates and releases nothing
  const fromTerms = (c: (typeof issued)[number]): Prev | undefined => {
    const t = contractTerms(c);
    if (!t) return undefined;
    if (t.checkIn !== start || t.checkOut !== end) return { start: t.checkIn, end: t.checkOut, total: c.totalPrice };
    if (t.amendment) {
      // an amendment for these very dates, issued again: it releases the same dates
      return {
        start: t.amendment.previousCheckIn,
        end: t.amendment.previousCheckOut,
        total: t.amendment.previousTotal ?? null,
      };
    }
    return null;
  };
  const fromChanges: Prev = open.length
    ? {
        start: toISODate(open[0].fromStart),
        end: toISODate(open[0].fromEnd),
        total: signed?.totalPrice ?? issued[0]?.totalPrice ?? open[0].previousTTC,
      }
    : null;

  let prev: Prev = null;
  if (signed) {
    // the signed agreement is the one being replaced; unsigned drafts in between don't count
    const v = fromTerms(signed);
    prev = v === undefined ? fromChanges : v;
  } else if (fromChanges) {
    prev = fromChanges;
  } else {
    for (const c of issued) {
      const v = fromTerms(c);
      if (v !== undefined) {
        prev = v;
        break;
      }
    }
  }
  if (!prev || (prev.start === start && prev.end === end)) return null;
  return {
    startDate: prev.start,
    endDate: prev.end,
    previousTotal: prev.total,
    previousSignedOn: signed?.signedAt ? toISODate(signed.signedAt) : null,
    changeIds: open.map((d) => d.id),
  };
}

type ReservationForContract = Reservation & {
  client: Client | null;
  payments: Payment[];
  contracts: Contract[];
  dateChanges: DateChange[];
};

export function loadReservationForContract(id: number) {
  return prisma.reservation.findUnique({
    where: { id },
    include: { client: true, payments: true, contracts: true, dateChanges: true },
  });
}

export type IssueResult =
  | { ok: true; contract: Contract; signUrl: string; emailSent: boolean; amendment: boolean }
  | { ok: false; error: string };

/**
 * Generate (and optionally email) the agreement for a stay. Previous pending
 * contracts are voided. `previous` forces the released dates of an amendment
 * (null = a plain contract); left undefined they are detected.
 */
export async function issueContract(
  reservationId: number,
  opts: {
    lang?: "en" | "fr";
    send?: boolean;
    previous?: { startDate: string; endDate: string } | null;
  } = {}
): Promise<IssueResult> {
  const r: ReservationForContract | null = await loadReservationForContract(reservationId);
  if (!r) return { ok: false, error: "not_found" };
  const lang = opts.lang ?? (r.client?.language === "fr" ? "fr" : "en");
  const clientName =
    r.clientName ?? (r.client ? `${r.client.firstname} ${r.client.lastname}` : null);
  if (!clientName) return { ok: false, error: "missing_client_name" };
  if (r.priceTTC <= 0) return { ok: false, error: "missing_price" };
  const clientEmail = r.email ?? r.client?.email ?? null;
  if (opts.send && !clientEmail) return { ok: false, error: "missing_client_email" };

  const detected = detectReleasedDates(r);
  let released: ReleasedDates | null = detected;
  if (opts.previous === null) released = null;
  else if (opts.previous) {
    if (opts.previous.endDate <= opts.previous.startDate) return { ok: false, error: "invalid_previous_dates" };
    const signed = r.contracts
      .filter((c) => c.status === "signed")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    released = {
      startDate: opts.previous.startDate,
      endDate: opts.previous.endDate,
      previousTotal: detected?.previousTotal ?? signed?.totalPrice ?? null,
      previousSignedOn: detected?.previousSignedOn ?? (signed?.signedAt ? toISODate(signed.signedAt) : null),
      changeIds: detected?.changeIds ?? [],
    };
  }

  const [s, rates, copy] = await Promise.all([getSettings(), getRateConfig(), getContent(lang)]);
  const checkIn = toISODate(r.startDate);
  const checkOut = toISODate(r.endDate);
  const params: ContractParams = {
    clientName,
    checkIn,
    checkOut,
    nights: nightsBetween(checkIn, checkOut),
    bedrooms: r.bedrooms,
    guests: r.guests,
    totalPrice: r.priceTTC,
    lang,
    ownerName: s.owner_name ?? "Annie CHRIQUI",
    noTax: r.noTax,
    depositRate: rates.depositPercent,
    // the wording as it stands today, kept with the agreement (Admin → Textes du site → Contrat)
    template: copy.contractText,
    bank: {
      accountName: s.bank_account_name ?? "",
      accountNumber: s.bank_account_number ?? "",
      bankName: s.bank_name ?? "",
      iban: s.bank_iban ?? "",
      bic: s.bank_bic ?? "",
    },
    issuedOn: toISODate(new Date()),
    received: rentReceived(r, r.payments),
    amendment: released
      ? {
          previousCheckIn: released.startDate,
          previousCheckOut: released.endDate,
          previousTotal: released.previousTotal,
          previousSignedOn: released.previousSignedOn,
        }
      : undefined,
  };
  const content = buildContract(params);

  await prisma.contract.updateMany({
    where: { reservationId, status: "pending" },
    data: { status: "void" },
  });
  const contract = await prisma.contract.create({
    data: {
      reservationId,
      token: randomBytes(24).toString("hex"),
      kind: released ? "amendment" : "contract",
      language: lang,
      clientName,
      clientEmail,
      totalPrice: r.priceTTC,
      depositAmount: content.deposit,
      bodyHtml: contractToHtml(content),
      termsJson: JSON.stringify(params),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  if (released?.changeIds.length) {
    await prisma.dateChange.updateMany({
      where: { id: { in: released.changeIds } },
      data: { contractId: contract.id },
    });
  }

  const signUrl = `${SITE_URL}${lang === "fr" ? "/fr" : ""}/contracts/sign/${contract.token}`;
  let emailSent = false;
  if (opts.send && clientEmail) {
    // wording: Admin → Textes du site → Emails
    const key = released ? "amendmentRequest" : "contractRequest";
    const t = await emailTexts(key, lang);
    const mail = await renderEmail(
      key,
      lang,
      {
        name: clientName,
        checkIn: formatDate(checkIn, lang),
        checkOut: formatDate(checkOut, lang),
        previousCheckIn: released ? formatDate(released.startDate, lang) : "",
        previousCheckOut: released ? formatDate(released.endDate, lang) : "",
      },
      { button: emailButton(signUrl, t.button) }
    );
    const res = await sendMail({
      to: clientEmail,
      toName: clientName,
      templateSlug: released ? "contract_amendment_request" : "contract_signature_request",
      reservationId,
      subject: mail.subject,
      html: mail.html,
    });
    emailSent = res.sent;
  }

  return { ok: true, contract, signUrl, emailSent, amendment: !!released };
}
