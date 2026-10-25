import "server-only";
import { randomBytes } from "node:crypto";
import type { Client, Contract, DateChange, Payment, Reservation } from "@prisma/client";
import { prisma } from "./db";
import { buildContract, contractToHtml, type ContractParams } from "./contract-content";
import { getSettings } from "./settings";
import { formatDate, nightsBetween, toISODate } from "./dates";
import { sendMail } from "./mailer";
import { SITE_URL } from "./seo";

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
 * The dates the next contract must release, or null when it is a plain
 * contract. Only stays that already have a signed agreement get an
 * amendment: the earliest approved change not yet covered by one gives the
 * dates that were signed for; failing that, a signed contract whose snapshot
 * shows other dates than the stay's current ones.
 */
export function detectReleasedDates(
  r: Pick<Reservation, "startDate" | "endDate"> & {
    contracts: Pick<Contract, "status" | "signedAt" | "totalPrice" | "termsJson" | "createdAt">[];
    dateChanges: Pick<DateChange, "id" | "status" | "contractId" | "fromStart" | "fromEnd" | "previousTTC" | "createdAt">[];
  }
): ReleasedDates | null {
  const signed = r.contracts
    .filter((c) => c.status === "signed")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!signed) return null;
  const start = toISODate(r.startDate);
  const end = toISODate(r.endDate);
  const open = r.dateChanges
    .filter((d) => d.status === "approved" && d.contractId == null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const signedOn = signed.signedAt ? toISODate(signed.signedAt) : null;

  let prev: { start: string; end: string } | null = null;
  if (open.length) prev = { start: toISODate(open[0].fromStart), end: toISODate(open[0].fromEnd) };
  else {
    const t = contractTerms(signed);
    if (t) prev = { start: t.checkIn, end: t.checkOut };
  }
  if (!prev || (prev.start === start && prev.end === end)) return null;
  return {
    startDate: prev.start,
    endDate: prev.end,
    previousTotal: signed.totalPrice,
    previousSignedOn: signedOn,
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

  const s = await getSettings();
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
    const fr = lang === "fr";
    const what = released
      ? fr
        ? `L'avenant à votre contrat de location pour la Villa ONLY VIEW (nouvelles dates : du ${formatDate(checkIn, "fr")} au ${formatDate(checkOut, "fr")}) est prêt à être signé en ligne. Il libère les dates du ${formatDate(released.startDate, "fr")} au ${formatDate(released.endDate, "fr")} et reprend les sommes déjà versées.`
        : `The amendment to your rental agreement for Villa ONLY VIEW (new dates: ${formatDate(checkIn, "en")} to ${formatDate(checkOut, "en")}) is ready to sign online. It releases ${formatDate(released.startDate, "en")} to ${formatDate(released.endDate, "en")} and carries over the amounts already paid.`
      : fr
        ? `Votre contrat de location pour la Villa ONLY VIEW (du ${checkIn} au ${checkOut}) est prêt à être signé en ligne :`
        : `Your rental agreement for Villa ONLY VIEW (${checkIn} → ${checkOut}) is ready to sign online:`;
    const res = await sendMail({
      to: clientEmail,
      toName: clientName,
      templateSlug: released ? "contract_amendment_request" : "contract_signature_request",
      reservationId,
      subject: released
        ? fr
          ? "Avenant à votre contrat — Villa ONLY VIEW"
          : "Amendment to your rental agreement — Villa ONLY VIEW"
        : fr
          ? "Votre contrat de location — Villa ONLY VIEW"
          : "Your rental agreement — Villa ONLY VIEW",
      html: fr
        ? `<p>Bonjour <strong>${clientName}</strong>,</p>
<p>${what}</p>
<p style="text-align:center;margin:24px 0;"><a href="${signUrl}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">RELIRE & SIGNER</a></p>
<p style="font-size:12px;color:#8a8a8a;">Ce lien est valable 30 jours.</p>`
        : `<p>Hello <strong>${clientName}</strong>,</p>
<p>${what}</p>
<p style="text-align:center;margin:24px 0;"><a href="${signUrl}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">REVIEW & SIGN</a></p>
<p style="font-size:12px;color:#8a8a8a;">This link is valid for 30 days.</p>`,
    });
    emailSent = res.sent;
  }

  return { ok: true, contract, signUrl, emailSent, amendment: !!released };
}
