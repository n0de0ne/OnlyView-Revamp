/**
 * Contract content builder — structured EN/FR seasonal rental agreement,
 * ported from the PHP ContractGenerator. The same structure feeds the HTML
 * signing page and the PDF renderer.
 */
import { addDays, formatDate, nightsBetween, todayISO } from "./dates";
import { getDict, type Dict } from "./i18n";

export type ContractTemplate = Dict["contractText"];

/** Deposit share for agreements issued before the rate was stored with them. */
export const DEPOSIT_RATE = 0.3;

export interface ContractParams {
  clientName: string;
  checkIn: string; // ISO
  checkOut: string; // ISO
  nights: number;
  bedrooms: number;
  guests: number;
  totalPrice: number; // TTC USD
  lang: "en" | "fr";
  ownerName: string;
  bank: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    iban: string;
    bic: string;
  };
  noTax?: boolean;
  /** deposit share of the rent (Réglages → Tarifs) when the agreement was issued */
  depositRate?: number;
  /** the wording (Admin → Textes du site → Contrat) when the agreement was issued */
  template?: ContractTemplate;
  /** day the agreement is dated (ISO) — defaults to today */
  issuedOn?: string;
  /** money already received toward the rent, oldest first (refunds negative) */
  received?: Array<{ date: string | null; amount: number }>;
  /** set when this agreement replaces an earlier one after a change of dates */
  amendment?: {
    previousCheckIn: string;
    previousCheckOut: string;
    previousTotal?: number | null;
    /** day the replaced agreement was signed (ISO), when it was */
    previousSignedOn?: string | null;
  };
}

export interface ContractSection {
  heading: string;
  paragraphs: string[]; // plain text; **bold** markers allowed
  bullets?: string[];
  table?: Array<[string, string]>;
}

export interface ContractContent {
  title: string;
  subtitle: string;
  intro: string[];
  sections: ContractSection[];
  dated: string;
  signatureLabels: { owner: string; tenant: string; date: string };
  deposit: number;
  balance: number;
  /** money already received toward the rent / still owed (amendments, part-paid stays) */
  received: number;
  remaining: number;
}

const money = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US") + " USD";

const pctOf = (rate = DEPOSIT_RATE) => Math.round(rate * 1000) / 10;

export function depositFor(total: number, rate = DEPOSIT_RATE): number {
  return Math.round(total * rate);
}

/** Sum of the money received toward the rent. */
export function totalReceived(received: ContractParams["received"]): number {
  return Math.round((received ?? []).reduce((s, r) => s + r.amount, 0) * 100) / 100;
}

/**
 * What is still owed and when, once part of the rent has been paid — the
 * paragraph and table every agreement carries when money was already received
 * (typically an amendment after a change of dates).
 */
function paymentTerms(p: ContractParams, deposit: number) {
  const fr = p.lang === "fr";
  const issued = p.issuedOn ?? todayISO();
  const received = totalReceived(p.received);
  const remaining = Math.round((p.totalPrice - received) * 100) / 100;
  const dueISO = addDays(p.checkIn, -30);
  const dueNow = dueISO <= issued;
  const due = fr
    ? dueNow
      ? "à la signature du présent contrat"
      : `au plus tard le ${formatDate(dueISO, "fr")} (30 jours avant l'arrivée)`
    : dueNow
      ? "upon signing this agreement"
      : `no later than ${formatDate(dueISO, "en")} (30 days prior to arrival)`;

  const table: Array<[string, string]> = (p.received ?? []).map((r) => {
    const on = r.date ? formatDate(r.date, p.lang) : null;
    const label =
      r.amount < 0
        ? fr
          ? on ? `Remboursé le ${on}` : "Remboursement"
          : on ? `Refunded on ${on}` : "Refund"
        : fr
          ? on ? `Reçu le ${on}` : "Acompte reçu"
          : on ? `Received on ${on}` : "Deposit received";
    return [label, money(r.amount)];
  });
  table.push(
    [fr ? "Loyer total" : "Total rent", money(p.totalPrice)],
    [fr ? `Acompte requis (${pctOf(p.depositRate)} %)` : `Deposit required (${pctOf(p.depositRate)}%)`, money(deposit)],
    [fr ? "Total déjà reçu" : "Total already received", money(received)],
    remaining >= 0
      ? [fr ? "Solde restant dû" : "Remaining balance", money(remaining)]
      : [fr ? "Trop-perçu en faveur du Locataire" : "Credit in favour of Tenant", money(-remaining)]
  );

  let schedule: string;
  if (remaining <= 0) {
    schedule = fr
      ? remaining === 0
        ? "Le loyer est intégralement réglé : aucune somme supplémentaire n'est due au titre de la location."
        : `Les sommes reçues dépassent le loyer total de **${money(-remaining)}**, montant porté au crédit du Locataire.`
      : remaining === 0
        ? "The rent is paid in full: nothing further is due for the rental."
        : `The amounts received exceed the total rent by **${money(-remaining)}**, which is credited to Tenant.`;
  } else if (received < deposit) {
    const rest = deposit - received;
    schedule = fr
      ? `Le complément d'acompte de **${money(rest)}** est dû à la signature du contrat, et le solde de **${money(remaining - rest)}** est dû ${due}.`
      : `The remaining deposit of **${money(rest)}** is due at the signing of this agreement, and the balance of **${money(remaining - rest)}** is due ${due}.`;
  } else {
    schedule = fr
      ? `L'acompte est réglé. Le solde restant de **${money(remaining)}** est dû ${due}.`
      : `The deposit has been paid. The remaining balance of **${money(remaining)}** is due ${due}.`;
  }

  const carried = p.amendment
    ? fr
      ? "Les sommes déjà versées au titre du contrat précédent sont intégralement reportées sur les nouvelles dates :"
      : "All amounts already paid under the previous agreement are carried over in full to the new dates:"
    : fr
      ? "Le Propriétaire reconnaît avoir déjà reçu les sommes suivantes :"
      : "Owner acknowledges having already received the following amounts:";

  return { received, remaining, table, schedule, carried };
}

/** The "change of dates" section opening an amendment. */
function amendmentSection(p: ContractParams): ContractSection | null {
  const a = p.amendment;
  if (!a) return null;
  const fr = p.lang === "fr";
  const L = fr ? "fr" : "en";
  const pci = formatDate(a.previousCheckIn, L);
  const pco = formatDate(a.previousCheckOut, L);
  const pn = nightsBetween(a.previousCheckIn, a.previousCheckOut);
  const ci = formatDate(p.checkIn, L);
  const co = formatDate(p.checkOut, L);
  const signed = a.previousSignedOn ? formatDate(a.previousSignedOn, L) : null;
  const table: Array<[string, string]> = [
    [fr ? "Dates précédentes (libérées)" : "Previous dates (released)", `${pci} - ${pco} (${pn} ${fr ? "nuits" : "nights"})`],
    [fr ? "Nouvelles dates" : "New dates", `${ci} - ${co} (${p.nights} ${fr ? "nuits" : "nights"})`],
  ];
  if (a.previousTotal != null && Math.round(a.previousTotal) !== Math.round(p.totalPrice)) {
    table.push([fr ? "Loyer précédent" : "Previous rent", money(a.previousTotal)]);
  }
  table.push([fr ? "Nouveau loyer" : "New rent", money(p.totalPrice)]);
  return fr
    ? {
        heading: "CHANGEMENT DE DATES",
        paragraphs: [
          `Le présent avenant modifie le contrat de location${signed ? ` signé le ${signed}` : ""} entre les mêmes parties pour la période du **${pci}** au **${pco}** (${pn} nuits).`,
          `D'un commun accord, les dates du **${pci}** au **${pco}** sont **libérées** : le Locataire renonce à tout droit sur ces dates et le Propriétaire est libre de les louer à nouveau.`,
          `La location porte désormais sur la période du **${ci}** au **${co}** (${p.nights} nuits). Le présent document reprend l'ensemble des conditions de la location avec les nouvelles dates et remplace le contrat précédent.`,
        ],
        table,
      }
    : {
        heading: "CHANGE OF DATES",
        paragraphs: [
          `This amendment modifies the rental agreement${signed ? ` signed on ${signed}` : ""} between the same parties for the period from **${pci}** to **${pco}** (${pn} nights).`,
          `By mutual agreement, the dates from **${pci}** to **${pco}** are **released**: Tenant waives any right to these dates and Owner is free to rent them again.`,
          `The rental now covers the period from **${ci}** to **${co}** (${p.nights} nights). This document restates all the terms of the rental with the new dates and replaces the previous agreement.`,
        ],
        table,
      };
}

/** Fill a clause's {placeholders}; an unknown one stays as written. */
const fillIn = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/**
 * The wording an agreement was issued with, else the original wording of the
 * code (agreements issued before it was editable), with the tax and balance
 * deadline those agreements quoted.
 */
function templateOf(p: ContractParams): ContractTemplate {
  if (p.template) return p.template;
  const raw = getDict(p.lang).contractText;
  return JSON.parse(fillIn(JSON.stringify(raw), { tax: 5, balanceDays: 30 })) as ContractTemplate;
}

export function buildContract(p: ContractParams): ContractContent {
  const deposit = depositFor(p.totalPrice, p.depositRate);
  const balance = p.totalPrice - deposit;
  const fr = p.lang === "fr";
  const ci = formatDate(p.checkIn, p.lang);
  const co = formatDate(p.checkOut, p.lang);
  const today = formatDate(p.issuedOn ?? todayISO(), p.lang);
  const amendment = amendmentSection(p);
  const paid = totalReceived(p.received) !== 0 ? paymentTerms(p, deposit) : null;
  const T = templateOf(p);
  const vars = {
    owner: p.ownerName,
    tenant: p.clientName,
    checkIn: ci,
    checkOut: co,
    nights: p.nights,
    bedrooms: p.bedrooms,
    guests: p.guests,
    totalAmount: money(p.totalPrice),
    depositAmount: money(deposit),
    balanceAmount: money(balance),
    date: today,
    taxClause: p.noTax ? "" : T.taxClause,
  };
  const f = (s: string) => fillIn(fillIn(s, vars), vars);
  const clauses = (list: ContractTemplate["clausesBefore"]): ContractSection[] =>
    list.map((c) => ({
      heading: f(c.heading),
      paragraphs: c.paragraphs.map(f),
      ...(c.bullets.length ? { bullets: c.bullets.map(f) } : {}),
    }));

  return {
    title: f(amendment ? T.amendmentTitle : T.title),
    subtitle: f(T.subtitle),
    intro: T.intro.map(f),
    sections: [
      ...(amendment ? [amendment] : []),
      ...clauses(T.clausesBefore),
      {
        heading: f(T.paymentHeading),
        paragraphs: [f(T.paymentIntro), ...(paid ? [paid.carried] : [f(T.paymentTerms), f(T.nonRefundable)])],
        ...(paid ? { table: paid.table } : {}),
      },
      ...(paid ? [{ heading: f(T.scheduleHeading), paragraphs: [paid.schedule, f(T.nonRefundable)] }] : []),
      {
        heading: f(T.bankHeading),
        paragraphs: [],
        table: [
          [fr ? "Titulaire du compte" : "Account Name", p.bank.accountName],
          [fr ? "Numéro de compte" : "Account Number", p.bank.accountNumber],
          [fr ? "Banque" : "Bank", p.bank.bankName],
          ["IBAN", p.bank.iban],
          ["BIC/SWIFT", p.bank.bic],
          [fr ? "Référence" : "Reference", `ONLY VIEW - ${p.clientName} - ${ci}`],
        ],
      },
      ...clauses(T.clausesAfter),
    ],
    dated: f(T.dated),
    signatureLabels: { owner: f(T.signatureOwner), tenant: f(T.signatureTenant), date: f(T.signatureDate) },
    deposit,
    balance,
    received: paid?.received ?? 0,
    remaining: paid?.remaining ?? p.totalPrice,
  };
}

/** Render structured contract content to clean HTML (signing page + email). */
export function contractToHtml(c: ContractContent): string {
  const bold = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const parts: string[] = [];
  parts.push(
    `<h1 style="text-align:center;font-size:19px;margin:0 0 4px;">${c.title}</h1>`,
    `<h2 style="text-align:center;font-size:15px;color:#1B4965;margin:0 0 24px;letter-spacing:0.15em;">${c.subtitle}</h2>`
  );
  for (const p of c.intro) parts.push(`<p>${bold(p)}</p>`);
  for (const s of c.sections) {
    parts.push(`<h3 style="font-size:14px;margin:22px 0 8px;color:#1B4965;">${s.heading}</h3>`);
    for (const p of s.paragraphs) parts.push(`<p>${bold(p)}</p>`);
    if (s.bullets) {
      parts.push(
        `<ul>${s.bullets.map((b) => `<li>${bold(b)}</li>`).join("")}</ul>`
      );
    }
    if (s.table) {
      parts.push(
        `<table style="width:100%;border-collapse:collapse;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">` +
          s.table
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 12px;font-weight:600;width:38%;">${k}</td><td style="padding:6px 12px;font-family:monospace;">${v}</td></tr>`
            )
            .join("") +
          `</table>`
      );
    }
  }
  parts.push(`<p style="margin-top:28px;"><strong>${c.dated}</strong></p>`);
  return parts.join("\n");
}
