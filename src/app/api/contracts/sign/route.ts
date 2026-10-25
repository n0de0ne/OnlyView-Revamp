import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { renderEmail } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/seo";
import { renderContractPdfFor, formatDateTime } from "@/lib/contract-render";
import { formatDate, toISODate, nightsBetween } from "@/lib/dates";
import { ownerNotifyEmail } from "@/lib/contact";
import { contractTerms } from "@/lib/contracts";
import { totalReceived } from "@/lib/contract-content";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().min(16).max(128),
  typedName: z.string().min(2).max(150),
  signature: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(400_000),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US") + " USD";

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { token, typedName, signature } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { token },
    include: { reservation: true },
  });
  if (!contract || contract.status !== "pending") {
    return NextResponse.json({ success: false, error: "not_signable" }, { status: 404 });
  }
  if (contract.expiresAt && contract.expiresAt < new Date()) {
    return NextResponse.json({ success: false, error: "expired" }, { status: 410 });
  }

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(typedName) !== norm(contract.clientName)) {
    return NextResponse.json({ success: false, error: "name_mismatch" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const signed = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: "signed",
      signatureData: signature,
      signedAt: new Date(),
      signerIp: ip,
      signerUserAgent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
    },
    include: { reservation: true },
  });

  await audit({
    action: "contract_signed",
    entityType: "contract",
    entityId: contract.id,
    details: { reservationId: contract.reservationId, by: typedName, ip },
  });

  const r = signed.reservation;
  const lang = signed.language === "fr" ? "fr" : "en";
  const checkIn = toISODate(r.startDate);
  const checkOut = toISODate(r.endDate);
  const nights = nightsBetween(checkIn, checkOut);
  const signedAtLabel = formatDateTime(signed.signedAt!, lang);
  const adminUrl = `${SITE_URL}/admin/reservations/${r.id}`;

  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 10px;color:#64748b;">${k}</td><td style="padding:6px 10px;font-weight:600;">${v}</td></tr>`;
  const table = (rows: string) =>
    `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;font-size:14px;margin:16px 0;">${rows}</table>`;

  // Owner notification — same details the legacy site sent
  await sendMail({
    to: await ownerNotifyEmail(),
    subject: `✅ Contract signed — ${signed.clientName} (${formatDate(checkIn, "en", { day: "numeric", month: "short" })} → ${formatDate(checkOut, "en", { day: "numeric", month: "short" })})`,
    templateSlug: "contract_signed_admin",
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    html: `<h2 style="margin-top:0;color:#1B4965;">Contract signed!</h2>
<p><strong>${signed.clientName}</strong> has signed the ${signed.kind === "amendment" ? "amendment (change of dates)" : "rental agreement"} for reservation #${r.id}.</p>
${table(
  row("Client", signed.clientName) +
    row("Check-in", formatDate(checkIn, "en")) +
    row("Check-out", formatDate(checkOut, "en")) +
    row("Duration", `${nights} nights`) +
    row("Total", money(signed.totalPrice)) +
    row("Deposit due", money(signed.depositAmount)) +
    row("Signed at", signedAtLabel) +
    row("IP address", ip ?? "—")
)}
<p style="text-align:center;margin:24px 0;">
  <a href="${adminUrl}" style="background:#1B4965;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Open the reservation</a>
  &nbsp;
  <a href="${SITE_URL}/api/contracts/pdf/${signed.token}" style="background:#C9A962;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Signed PDF</a>
</p>`,
  });

  // Client copy with the signed PDF attached (EN + FR, like the legacy site)
  const to = signed.clientEmail ?? r.email ?? null;
  if (to) {
    const { pdf } = await renderContractPdfFor(signed);
    const received = totalReceived(contractTerms(signed)?.received);
    const summary = table(
      row(lang === "fr" ? "Arrivée" : "Check-in", formatDate(checkIn, lang)) +
        row(lang === "fr" ? "Départ" : "Check-out", formatDate(checkOut, lang)) +
        row(lang === "fr" ? "Durée" : "Duration", `${nights} ${lang === "fr" ? "nuits" : "nights"}`) +
        row("Total", money(signed.totalPrice)) +
        (received !== 0
          ? row(lang === "fr" ? "Déjà reçu" : "Already received", money(received)) +
            row(lang === "fr" ? "Solde restant" : "Remaining balance", money(Math.max(0, signed.totalPrice - received)))
          : row(lang === "fr" ? "Acompte" : "Deposit", money(signed.depositAmount)) +
            row(lang === "fr" ? "Solde (30 j. avant l'arrivée)" : "Balance (30 days before arrival)", money(signed.totalPrice - signed.depositAmount)))
    );
    // wording: Admin → Textes du site → Emails (the guest gets both languages)
    const short = (iso: string, L: "en" | "fr", year = false) =>
      formatDate(iso, L, { day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}) });
    const mailIn = async (L: "en" | "fr") =>
      renderEmail(
        "contractSigned",
        L,
        { name: signed.clientName, checkIn: short(checkIn, L), checkOut: short(checkOut, L, true) },
        { summary }
      );
    const [enMail, frMail] = await Promise.all([mailIn("en"), mailIn("fr")]);
    const en = enMail.html;
    const fr = frMail.html;
    const other = (label: string, body: string) =>
      `<div style="background:#f8fafc;padding:20px;border-radius:8px;margin-top:24px;"><p style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin:0 0 10px;">${label}</p>${body}</div>`;

    await sendMail({
      to,
      toName: signed.clientName,
      subject: lang === "fr" ? frMail.subject : enMail.subject,
      templateSlug: "contract_signed_client",
      reservationId: r.id,
      clientId: r.clientId ?? undefined,
      html: lang === "fr" ? fr + other("ENGLISH VERSION", en) : en + other("VERSION FRANÇAISE", fr),
      attachments: [
        {
          filename: "Villa_ONLY_VIEW_Contract_Signed.pdf",
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  }

  return NextResponse.json({ success: true, copySentTo: to });
}
