/**
 * Contract content builder — structured EN/FR seasonal rental agreement,
 * ported from the PHP ContractGenerator. The same structure feeds the HTML
 * signing page and the PDF renderer.
 */
import { formatDate } from "./dates";

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
}

const money = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US") + " USD";

export function depositFor(total: number): number {
  return Math.round(total * DEPOSIT_RATE);
}

export function buildContract(p: ContractParams): ContractContent {
  const deposit = depositFor(p.totalPrice);
  const balance = p.totalPrice - deposit;
  const ci = formatDate(p.checkIn, p.lang);
  const co = formatDate(p.checkOut, p.lang);
  const today = formatDate(new Date(), p.lang);

  if (p.lang === "fr") {
    return {
      title: "CONTRAT DE LOCATION SAISONNIÈRE",
      subtitle: "VILLA ONLY VIEW",
      intro: [
        `Le présent contrat est conclu entre **${p.ownerName}** (ci-après « le Propriétaire ») et **${p.clientName}** (ci-après « le Locataire »).`,
        `Le Propriétaire dispose d'une villa de 4 chambres située à Pointe Milou, dénommée « Villa Only View ».`,
        `Le Locataire souhaite louer un hébergement sur l'île de Saint-Barthélemy pour la période du **${ci}** au **${co}** (${p.nights} nuits) pour **${p.bedrooms}** chambre(s).`,
        `EN CONSÉQUENCE, compte tenu des engagements mutuels contenus dans le présent contrat, les parties conviennent de ce qui suit :`,
      ],
      sections: [
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
            `Le Locataire s'engage à verser au Propriétaire la somme de **${money(p.totalPrice)}**. Un acompte non remboursable de **${money(deposit)}** est dû à la signature du contrat afin de garantir la location de la villa, et le solde (**${money(balance)}**) est dû 30 jours avant l'arrivée.`,
            "**Tous les acomptes et paiements finaux sont NON REMBOURSABLES.**",
          ],
        },
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
    };
  }

  return {
    title: "SEASONAL RENTAL AGREEMENT",
    subtitle: "VILLA ONLY VIEW",
    intro: [
      `This Agreement is entered between **${p.ownerName}** (hereinafter referred to as "Owner") and **${p.clientName}** (hereinafter referred to as "Tenant").`,
      `Whereas Owner has a 4 bedroom Villa located in Pointe Milou named "Villa Only View".`,
      `Whereas Tenant wishes to secure lodging on the island of Saint-Barthelemy for the period of time from **${ci}** to **${co}** (${p.nights} nights) for **${p.bedrooms}** bedroom(s).`,
      `NOW THEREFORE, in consideration of the mutual covenants, agreements, representations and warranties contained herein, the parties agree as follows:`,
    ],
    sections: [
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
          `Tenant agrees to pay to Owner the sum of **${money(p.totalPrice)}**. A non-refundable deposit of **${money(deposit)}** is due in order to secure the rental of the villa at time of the signing of the contract and the remaining balance (**${money(balance)}**) is due 30 days prior to arrival.`,
          "**All deposits and final payments are NON-REFUNDABLE.**",
        ],
      },
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
