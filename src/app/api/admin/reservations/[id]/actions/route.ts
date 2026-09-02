import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { buildContract, contractToHtml } from "@/lib/contract-content";
import { getSettings } from "@/lib/settings";
import { toISODate, nightsBetween } from "@/lib/dates";
import { newPortalToken } from "@/lib/guest-auth";
import { sendMail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/seo";
import { earnForReservation } from "@/lib/loyalty";
import { sendBookingConfirmation } from "@/lib/booking-emails";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  action: z.enum([
    "archive",
    "unarchive",
    "generate-contract",
    "send-contract",
    "portal-link",
    "send-portal-email",
    "add-payment",
    "delete-payment",
    "award-loyalty",
    "send-confirmation",
  ]),
  lang: z.enum(["en", "fr"]).optional(),
  payment: z
    .object({
      kind: z.enum(["deposit", "balance", "extra", "refund"]),
      amount: z.number(),
      method: z.enum(["wire", "card", "cash", "check", "other"]).default("wire"),
      receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().max(500).optional().nullable(),
    })
    .optional(),
  paymentId: z.number().int().optional(),
});

export const POST = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!reservation) return jsonError("not_found", 404);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const { action } = parsed.data;

  const auditIt = (a: string, details?: unknown) =>
    audit({
      action: a,
      entityType: "reservation",
      entityId: id,
      details,
      userId: user.id,
      username: user.username,
    });

  switch (action) {
    case "archive":
    case "unarchive": {
      await prisma.reservation.update({
        where: { id },
        data: {
          isArchived: action === "archive",
          archivedAt: action === "archive" ? new Date() : null,
        },
      });
      await auditIt(`reservation_${action}`);
      return jsonOk();
    }

    case "generate-contract":
    case "send-contract": {
      const lang = parsed.data.lang ?? (reservation.client?.language === "fr" ? "fr" : "en");
      const clientName =
        reservation.clientName ??
        (reservation.client
          ? `${reservation.client.firstname} ${reservation.client.lastname}`
          : null);
      if (!clientName) return jsonError("missing_client_name");
      if (reservation.priceTTC <= 0) return jsonError("missing_price");

      const s = await getSettings();
      const content = buildContract({
        clientName,
        checkIn: toISODate(reservation.startDate),
        checkOut: toISODate(reservation.endDate),
        nights: nightsBetween(toISODate(reservation.startDate), toISODate(reservation.endDate)),
        bedrooms: reservation.bedrooms,
        guests: reservation.guests,
        totalPrice: reservation.priceTTC,
        lang,
        ownerName: s.owner_name ?? "Annie CHRIQUI",
        noTax: reservation.noTax,
        bank: {
          accountName: s.bank_account_name ?? "",
          accountNumber: s.bank_account_number ?? "",
          bankName: s.bank_name ?? "",
          iban: s.bank_iban ?? "",
          bic: s.bank_bic ?? "",
        },
      });

      // void previous pending contracts for this reservation
      await prisma.contract.updateMany({
        where: { reservationId: id, status: "pending" },
        data: { status: "void" },
      });

      const contract = await prisma.contract.create({
        data: {
          reservationId: id,
          token: randomBytes(24).toString("hex"),
          language: lang,
          clientName,
          clientEmail: reservation.email ?? reservation.client?.email ?? null,
          totalPrice: reservation.priceTTC,
          depositAmount: content.deposit,
          bodyHtml: contractToHtml(content),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });

      const signUrl = `${SITE_URL}${lang === "fr" ? "/fr" : ""}/contracts/sign/${contract.token}`;

      let emailSent = false;
      if (action === "send-contract") {
        const to = contract.clientEmail;
        if (!to) return jsonError("missing_client_email");
        const fr = lang === "fr";
        const res = await sendMail({
          to,
          toName: clientName,
          templateSlug: "contract_signature_request",
          reservationId: id,
          subject: fr
            ? "Votre contrat de location — Villa ONLY VIEW"
            : "Your rental agreement — Villa ONLY VIEW",
          html: fr
            ? `<p>Bonjour <strong>${clientName}</strong>,</p>
<p>Votre contrat de location pour la Villa ONLY VIEW (du ${toISODate(reservation.startDate)} au ${toISODate(reservation.endDate)}) est prêt à être signé en ligne :</p>
<p style="text-align:center;margin:24px 0;"><a href="${signUrl}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">RELIRE & SIGNER</a></p>
<p style="font-size:12px;color:#8a8a8a;">Ce lien est valable 30 jours.</p>`
            : `<p>Hello <strong>${clientName}</strong>,</p>
<p>Your rental agreement for Villa ONLY VIEW (${toISODate(reservation.startDate)} → ${toISODate(reservation.endDate)}) is ready to sign online:</p>
<p style="text-align:center;margin:24px 0;"><a href="${signUrl}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">REVIEW & SIGN</a></p>
<p style="font-size:12px;color:#8a8a8a;">This link is valid for 30 days.</p>`,
        });
        emailSent = res.sent;
      }

      await auditIt("contract_generated", { contractId: contract.id, lang, sent: emailSent });
      return jsonOk({
        contract: { id: contract.id, token: contract.token, status: contract.status },
        signUrl,
        emailSent,
      });
    }

    case "portal-link":
    case "send-portal-email": {
      let token = reservation.portalToken;
      if (!token) {
        token = newPortalToken();
        await prisma.reservation.update({ where: { id }, data: { portalToken: token } });
      }
      const portalUrl = `${SITE_URL}/api/account/login?pt=${token}`;

      let emailSent = false;
      if (action === "send-portal-email") {
        const to = reservation.email ?? reservation.client?.email;
        if (!to) return jsonError("missing_client_email");
        const fr = reservation.client?.language === "fr";
        const name =
          reservation.clientName ??
          `${reservation.client?.firstname ?? ""} ${reservation.client?.lastname ?? ""}`.trim();
        const res = await sendMail({
          to,
          toName: name,
          templateSlug: "guest_portal_access",
          reservationId: id,
          clientId: reservation.clientId ?? undefined,
          subject: fr
            ? "Votre Espace Client est prêt — Villa ONLY VIEW"
            : "Your Guest Portal is ready — Villa ONLY VIEW",
          html: fr
            ? `<p>Bonjour <strong>${name}</strong>,</p>
<p>Votre espace client Villa ONLY VIEW est prêt : détails de votre séjour, contrat, points de fidélité.</p>
<p style="text-align:center;margin:24px 0;"><a href="${portalUrl}" style="background:#1B4965;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">ACCÉDER À MON ESPACE</a></p>
<p style="font-size:12px;color:#8a8a8a;">Ce lien est personnel — merci de ne pas le partager.</p>`
            : `<p>Hello <strong>${name}</strong>,</p>
<p>Your Villa ONLY VIEW guest portal is ready: stay details, contract, loyalty points.</p>
<p style="text-align:center;margin:24px 0;"><a href="${portalUrl}" style="background:#1B4965;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">OPEN MY PORTAL</a></p>
<p style="font-size:12px;color:#8a8a8a;">This link is personal — please don't share it.</p>`,
        });
        emailSent = res.sent;
        await prisma.reservation.update({ where: { id }, data: { portalEmailSent: true } });
      }
      await auditIt(action === "portal-link" ? "portal_link_created" : "portal_email_sent");
      return jsonOk({ portalUrl, emailSent });
    }

    case "add-payment": {
      const p = parsed.data.payment;
      if (!p) return jsonError("missing_payment");
      await prisma.payment.create({
        data: {
          reservationId: id,
          kind: p.kind,
          amount: p.amount,
          method: p.method,
          receivedAt: new Date(`${p.receivedAt}T00:00:00Z`),
          notes: p.notes ?? null,
        },
      });
      // roll up flags
      const payments = await prisma.payment.findMany({ where: { reservationId: id } });
      const paid = payments.reduce(
        (s, x) => s + (x.kind === "refund" ? -x.amount : x.amount),
        0
      );
      await prisma.reservation.update({
        where: { id },
        data: {
          depositReceived: paid > 0,
          balanceReceived: reservation.priceTTC > 0 && paid >= reservation.priceTTC - 0.01,
        },
      });
      await afterPayment(id);
      await auditIt("payment_added", { amount: p.amount, kind: p.kind });
      return jsonOk({ totalPaid: paid });
    }

    case "delete-payment": {
      if (!parsed.data.paymentId) return jsonError("missing_payment_id");
      await prisma.payment.deleteMany({
        where: { id: parsed.data.paymentId, reservationId: id },
      });
      await auditIt("payment_deleted", { paymentId: parsed.data.paymentId });
      return jsonOk();
    }

    case "award-loyalty": {
      const points = await earnForReservation(id);
      await auditIt("loyalty_awarded", { points });
      return jsonOk({ points });
    }

    case "send-confirmation": {
      if (reservation.status !== "confirmed") return jsonError("not_confirmed");
      const res = await sendBookingConfirmation(id, { force: true });
      if (res.skipped === "no_email") return jsonError("missing_client_email");
      await auditIt("confirmation_email_sent", res);
      return jsonOk({ emailSent: res.sent, queued: res.queued });
    }
  }
});

async function afterPayment(reservationId: number) {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (r?.balanceReceived && r.clientId && r.status === "confirmed") {
    await earnForReservation(reservationId);
  }
}
