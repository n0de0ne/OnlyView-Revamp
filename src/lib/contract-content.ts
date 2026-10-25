/**
 * Contract content builder — structured EN/FR seasonal rental agreement,
 * ported from the PHP ContractGenerator. The same structure feeds the HTML
 * signing page and the PDF renderer.
 */
import { addDays, formatDate, nightsBetween, todayISO } from "./dates";

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

export function buildContract(p: ContractParams): ContractContent {
  const deposit = depositFor(p.totalPrice, p.depositRate);
  const balance = p.totalPrice - deposit;
  const ci = formatDate(p.checkIn, p.lang);
  const co = formatDate(p.checkOut, p.lang);
  const today = formatDate(p.issuedOn ?? todayISO(), p.lang);
  const amendment = amendmentSection(p);
  const paid = totalReceived(p.received) !== 0 ? paymentTerms(p, deposit) : null;

  if (p.lang === "fr") {
    return {
      title: amendment ? "AVENANT AU CONTRAT DE LOCATION" : "CONTRAT DE LOCATION SAISONNIÈRE",
      subtitle: "VILLA ONLY VIEW",
      intro: [
        `Le présent contrat est conclu entre **${p.ownerName}** (ci-après « le Propriétaire ») et **${p.clientName}** (ci-après « le Locataire »).`,
        `Le Propriétaire dispose d'une villa de 4 chambres située à Pointe Milou, dénommée « Villa Only View ».`,
        `Le Locataire souhaite louer un hébergement sur l'île de Saint-Barthélemy pour la période du **${ci}** au **${co}** (${p.nights} nuits) pour **${p.bedrooms}** chambre(s).`,
        `EN CONSÉQUENCE, compte tenu des engagements mutuels contenus dans le présent contrat, les parties conviennent de ce qui suit :`,
      ],
      sections: [
        ...(amendment ? [amendment] : []),
        {
          heading: "AGENTS",
          paragraphs: [
            "Chacune des parties reconnaît qu'aucun agent immobilier ou agent de voyage n'est intervenu dans la conclusion de la présente location et que le contact a été direct, sans l'intervention d'un tiers qui aurait droit à une commission ou à toute autre forme de rémunération.",
          ],
        },
        {
          heading: "DESCRIPTION DU BIEN",
          paragraphs: [
            "Le Locataire s'engage à louer le bien suivant, situé à Pointe Milou, île de Saint-Barthélemy :",
            "Une villa de 4 chambres avec 4 salles de bain, cuisine entièrement équipée, terrasse, piscine et espace de vie.",
          ],
        },
        {
          heading: "NOMBRE DE LOCATAIRES",
          paragraphs: [
            `Le présent contrat autorise **${p.guests}** personne(s) à occuper les lieux pendant la durée du contrat. Le Locataire s'engage à ce qu'aucune autre personne ne soit autorisée à séjourner sur place.`,
          ],
        },
        {
          heading: "PAIEMENT DU LOYER/ACOMPTE",
          paragraphs: [
            `Le loyer total à payer pour la période indiquée ci-dessus s'élève à **${money(p.totalPrice)}**${p.noTax ? "" : ", incluant le loyer et la taxe de séjour locale de 5 %"}, payable comme suit :`,
            ...(paid
              ? [paid.carried]
              : [
                  `Le Locataire s'engage à verser au Propriétaire la somme de **${money(p.totalPrice)}**. Un acompte non remboursable de **${money(deposit)}** est dû à la signature du contrat afin de garantir la location de la villa, et le solde (**${money(balance)}**) est dû 30 jours avant l'arrivée.`,
                  "**Tous les acomptes et paiements finaux sont NON REMBOURSABLES.**",
                ]),
          ],
          ...(paid ? { table: paid.table } : {}),
        },
        ...(paid
          ? [
              {
                heading: "ÉCHÉANCIER",
                paragraphs: [paid.schedule, "**Tous les acomptes et paiements finaux sont NON REMBOURSABLES.**"],
              },
            ]
          : []),
        {
          heading: "COORDONNÉES BANCAIRES POUR VIREMENT",
          paragraphs: [],
          table: [
            ["Titulaire du compte", p.bank.accountName],
            ["Numéro de compte", p.bank.accountNumber],
            ["Banque", p.bank.bankName],
            ["IBAN", p.bank.iban],
            ["BIC/SWIFT", p.bank.bic],
            ["Référence", `ONLY VIEW - ${p.clientName} - ${ci}`],
          ],
        },
        {
          heading: "OBLIGATIONS DU PROPRIÉTAIRE",
          paragraphs: [],
          bullets: [
            "Le ménage quotidien est assuré, sauf le dimanche et les jours fériés locaux.",
            "Tout le linge de maison et les serviettes sont fournis.",
            "L'électricité, l'eau et les communications téléphoniques locales sont incluses dans le montant de la location.",
            "Toutes les taxes, charges et prestations relatives au bien sont incluses dans le prix indiqué ci-dessus.",
            "Le Propriétaire est responsable de l'entretien de la piscine, des jardins, des équipements et de tout le matériel de la propriété.",
          ],
        },
        {
          heading: "OBLIGATIONS DU LOCATAIRE",
          paragraphs: [],
          bullets: [
            "Le Locataire est responsable de tous les dommages causés au bien, au-delà de l'usure normale.",
            "Le Locataire informera immédiatement le Propriétaire en cas de fuite d'eau, d'incendie ou de tout autre dommage nécessitant une réparation ou une attention immédiate.",
          ],
        },
        {
          heading: "INTÉGRALITÉ DE L'ACCORD",
          paragraphs: [
            "Le présent contrat constitue l'intégralité de l'accord entre les parties concernant son objet et remplace tous les accords, déclarations ou ententes antérieurs ou concomitants. Aucun avenant ni aucune modification du présent contrat ne saurait engager les parties sans un écrit signé par celles-ci.",
          ],
        },
      ],
      dated: `FAIT LE : ${today}`,
      signatureLabels: {
        owner: "Le Propriétaire",
        tenant: "Le Locataire",
        date: "Date",
      },
      deposit,
      balance,
      received: paid?.received ?? 0,
      remaining: paid?.remaining ?? p.totalPrice,
    };
  }

  return {
    title: amendment ? "AMENDMENT TO THE RENTAL AGREEMENT" : "SEASONAL RENTAL AGREEMENT",
    subtitle: "VILLA ONLY VIEW",
    intro: [
      `This Agreement is entered between **${p.ownerName}** (hereinafter referred to as "Owner") and **${p.clientName}** (hereinafter referred to as "Tenant").`,
      `Whereas Owner has a 4 bedroom Villa located in Pointe Milou named "Villa Only View".`,
      `Whereas Tenant wishes to secure lodging on the island of Saint-Barthelemy for the period of time from **${ci}** to **${co}** (${p.nights} nights) for **${p.bedrooms}** bedroom(s).`,
      `NOW THEREFORE, in consideration of the mutual covenants, agreements, representations and warranties contained herein, the parties agree as follows:`,
    ],
    sections: [
      ...(amendment ? [amendment] : []),
      {
        heading: "AGENTS",
        paragraphs: [
          "It is acknowledged by each of the parties that no real estate or travel agent assisted in the securing of the rental and that the contact was direct in nature without the intervention of a third party who would be entitled to a commission or other form of payment in compensation for the securing of the rental.",
        ],
      },
      {
        heading: "DESCRIPTION OF PROPERTY",
        paragraphs: [
          "The Tenant agrees to rent the following property, located in Pointe Milou, island of Saint-Barthelemy:",
          "A 4 Bedroom Villa with 4 bathrooms, fully equipped kitchen, terrace, pool, and living room area.",
        ],
      },
      {
        heading: "NUMBER OF TENANTS",
        paragraphs: [
          `This agreement permits **${p.guests}** people to occupy the premises during the duration of this contract and Tenant agrees that no others will be permitted to lodge on the premises.`,
        ],
      },
      {
        heading: "PAYMENT OF RENT/DEPOSIT",
        paragraphs: [
          `The total rent to be paid for the time period specified above shall be the sum of **${money(p.totalPrice)}** (UNITED STATES DOLLARS)${p.noTax ? "" : " which includes the rental fee and 5% local tax"}, payable as follows:`,
          ...(paid
            ? [paid.carried]
            : [
                `Tenant agrees to pay to Owner the sum of **${money(p.totalPrice)}**. A non-refundable deposit of **${money(deposit)}** is due in order to secure the rental of the villa at time of the signing of the contract and the remaining balance (**${money(balance)}**) is due 30 days prior to arrival.`,
                "**All deposits and final payments are NON-REFUNDABLE.**",
              ]),
        ],
        ...(paid ? { table: paid.table } : {}),
      },
      ...(paid
        ? [
            {
              heading: "PAYMENT SCHEDULE",
              paragraphs: [paid.schedule, "**All deposits and final payments are NON-REFUNDABLE.**"],
            },
          ]
        : []),
      {
        heading: "BANK DETAILS FOR WIRE TRANSFER",
        paragraphs: [],
        table: [
          ["Account Name", p.bank.accountName],
          ["Account Number", p.bank.accountNumber],
          ["Bank", p.bank.bankName],
          ["IBAN", p.bank.iban],
          ["BIC/SWIFT", p.bank.bic],
          ["Reference", `ONLY VIEW - ${p.clientName} - ${ci}`],
        ],
      },
      {
        heading: "DUTIES OF OWNER",
        paragraphs: [],
        bullets: [
          "Daily housekeeping is provided, except on Sundays and local holidays.",
          "All linens and towels.",
          "All electricity, water and local telephone charges are included in the rental amount paid.",
          "All taxes, costs, amenities, service charges and other relating to the property are included in the above-stated price.",
          "Owner shall be responsible for the maintenance of the pool, gardens, equipment, appliances and all other material and equipment on the property.",
        ],
      },
      {
        heading: "DUTIES OF TENANT",
        paragraphs: [],
        bullets: [
          "Tenant shall be responsible for all damages to the property other than for ordinary wear and tear.",
          "Tenant shall immediately advise Owner in the event of water leaks, fire or other damages and/or matters requiring immediate repair or attention.",
        ],
      },
      {
        heading: "ENTIRE AGREEMENT",
        paragraphs: [
          "This agreement constitutes the entire agreement between the parties pertaining to the subject matter contained herein and supersedes all prior or contemporaneous agreements, representations or understandings of the parties. No supplement, modification, or amendment of this agreement shall be binding unless executed in writing by the parties.",
        ],
      },
    ],
    dated: `DATED: ${today}`,
    signatureLabels: { owner: "Owner", tenant: "Tenant", date: "Date" },
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
