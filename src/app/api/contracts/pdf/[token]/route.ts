import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildContract } from "@/lib/contract-content";
import { renderContractPdf } from "@/lib/contract-pdf";
import { getSettings } from "@/lib/settings";
import { toISODate, nightsBetween, formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Streams the contract PDF (with the signature once signed). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { token },
    include: { reservation: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const s = await getSettings();
  const r = contract.reservation;
  const lang = contract.language === "fr" ? "fr" : "en";
  const content = buildContract({
    clientName: contract.clientName,
    checkIn: toISODate(r.startDate),
    checkOut: toISODate(r.endDate),
    nights: nightsBetween(toISODate(r.startDate), toISODate(r.endDate)),
    bedrooms: r.bedrooms,
    guests: r.guests,
    totalPrice: contract.totalPrice,
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
  });

  const pdf = await renderContractPdf(content, {
    ownerName: s.owner_name ?? "Annie CHRIQUI",
    labels: content.signatureLabels,
    signaturePngDataUrl: contract.status === "signed" ? contract.signatureData : null,
    signerName: contract.status === "signed" ? contract.clientName : undefined,
    signedAtLabel:
      contract.status === "signed" && contract.signedAt
        ? formatDate(contract.signedAt, lang)
        : undefined,
  });

  const filename = `onlyview-contract-${r.id}${contract.status === "signed" ? "-signed" : ""}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
