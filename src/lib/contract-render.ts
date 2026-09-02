import "server-only";
import type { Contract, Reservation } from "@prisma/client";
import { buildContract } from "./contract-content";
import { renderContractPdf } from "./contract-pdf";
import { getSettings } from "./settings";
import { toISODate, nightsBetween, formatDate } from "./dates";

/** Date + time in villa local time, e.g. "12 March 2027, 14:05 (St-Barth)". */
export function formatDateTime(d: Date, lang: "en" | "fr"): string {
  const s = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/St_Barthelemy",
  }).format(d);
  return `${s} (St-Barth)`;
}

/**
 * Render a contract to PDF from its stored row — the single code path used by
 * the download route and by the emails sent after signing, so the client's
 * copy and the admin's download are byte-for-byte the same document.
 */
export async function renderContractPdfFor(
  contract: Contract & { reservation: Reservation }
): Promise<{ pdf: Uint8Array; lang: "en" | "fr"; filename: string }> {
  const s = await getSettings();
  const r = contract.reservation;
  const lang = contract.language === "fr" ? "fr" : "en";
  const ownerName = s.owner_name ?? "Annie CHRIQUI";

  const content = buildContract({
    clientName: contract.clientName,
    checkIn: toISODate(r.startDate),
    checkOut: toISODate(r.endDate),
    nights: nightsBetween(toISODate(r.startDate), toISODate(r.endDate)),
    bedrooms: r.bedrooms,
    guests: r.guests,
    totalPrice: contract.totalPrice,
    lang,
    ownerName,
    noTax: r.noTax,
    bank: {
      accountName: s.bank_account_name ?? "",
      accountNumber: s.bank_account_number ?? "",
      bankName: s.bank_name ?? "",
      iban: s.bank_iban ?? "",
      bic: s.bank_bic ?? "",
    },
  });

  const signed = contract.status === "signed" && !!contract.signedAt;
  const pdf = await renderContractPdf(content, {
    ownerName,
    labels: content.signatureLabels,
    signaturePngDataUrl: signed ? contract.signatureData : null,
    signerName: signed ? contract.clientName : undefined,
    signedAtLabel: signed ? formatDate(contract.signedAt!, lang) : undefined,
    certification: signed
      ? {
          lang,
          signerName: contract.clientName,
          signedAt: formatDateTime(contract.signedAt!, lang),
          ip: contract.signerIp,
        }
      : undefined,
  });

  return {
    pdf,
    lang,
    filename: `onlyview-contract-${r.id}${signed ? "-signed" : ""}.pdf`,
  };
}
