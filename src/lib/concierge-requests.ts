import "server-only";
import type { ReservationExtra } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { portalUrlFor } from "./guest-stay";
import { formatDate, todayISO } from "./dates";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Statuses the owner answers a concierge request with — the guest hears about each. */
export const ANSWERED_STATUSES = ["confirmed", "declined", "cancelled"] as const;

/** Concierge requests on stays still to come or under way, the ones the owner can still act on. */
export const liveConciergeWhere = () => ({
  kind: "concierge",
  reservation: {
    status: { in: ["option", "confirmed"] },
    isArchived: false,
    endDate: { gte: new Date(`${todayISO()}T00:00:00Z`) },
  },
});

/** Unanswered concierge requests — the admin menu badge. */
export const pendingConciergeCount = () =>
  prisma.reservationExtra.count({ where: { ...liveConciergeWhere(), status: "requested" } });

/** "Sat 2 Oct · 20:00 · 4 guests" — what the guest asked for. */
export function requestWhen(
  i: Pick<ReservationExtra, "serviceDate" | "serviceTime" | "guests">,
  locale: "en" | "fr"
) {
  return [
    i.serviceDate && formatDate(i.serviceDate, locale, { weekday: "short", day: "numeric", month: "short" }),
    i.serviceTime,
    i.guests != null &&
      (locale === "fr"
        ? `${i.guests} pers.`
        : `${i.guests} guest${i.guests > 1 ? "s" : ""}`),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Email the guest the owner's answer to a concierge request (confirmed,
 * declined or cancelled), with the owner's note and a link to the portal.
 * The guest asked for it from the portal themselves, so this goes to agency
 * guests too.
 */
export async function notifyGuestOfConciergeAnswer(itemId: number): Promise<boolean> {
  const item = await prisma.reservationExtra.findUnique({
    where: { id: itemId },
    include: { reservation: { include: { client: true } } },
  });
  if (!item || item.kind !== "concierge") return false;
  if (!(ANSWERED_STATUSES as readonly string[]).includes(item.status)) return false;
  const r = item.reservation;
  const to = r.email ?? r.client?.email;
  if (!to) return false;
  const fr = r.client?.language === "fr";
  const L = fr ? "fr" : "en";
  const name = r.clientName ?? `${r.client?.firstname ?? ""} ${r.client?.lastname ?? ""}`.trim();
  const when = requestWhen(item, L);
  const portal = await portalUrlFor(r.id, L);
  const confirmed = item.status === "confirmed";

  const verdict = fr
    ? confirmed
      ? "est confirmée"
      : item.status === "declined"
        ? "n'a malheureusement pas pu être confirmée"
        : "a été annulée"
    : confirmed
      ? "is confirmed"
      : item.status === "declined"
        ? "unfortunately could not be confirmed"
        : "has been cancelled";
  const color = confirmed ? "#2e7d5b" : "#8a8a8a";
  const note = item.adminNote
    ? `<p style="background:#f8fafc;padding:14px 18px;border-left:3px solid #C9A962;">${esc(item.adminNote).replace(/\n/g, "<br>")}</p>`
    : "";
  const html = `<p>${fr ? "Bonjour" : "Hello"} <strong>${esc(name)}</strong>,</p>
<p>${fr ? "Votre demande de conciergerie" : "Your concierge request"} ${verdict}&nbsp;:</p>
<p style="border:1px solid #e5e5e5;padding:14px 18px;">
<strong>${esc(item.label)}</strong><br>
${esc(when)}<br>
<span style="color:${color};font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">${
    fr
      ? { confirmed: "Confirmée", declined: "Non disponible", cancelled: "Annulée" }[item.status]
      : { confirmed: "Confirmed", declined: "Unavailable", cancelled: "Cancelled" }[item.status]
  }</span>
</p>
${note}
${!confirmed ? `<p>${fr ? "Répondez simplement à cet email si vous souhaitez une autre option." : "Just reply to this email if you would like another option."}</p>` : ""}
${portal ? `<p style="text-align:center;margin:24px 0;"><a href="${portal}" style="background:#1B4965;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">${fr ? "MES DEMANDES DE CONCIERGERIE" : "MY CONCIERGE REQUESTS"}</a></p>` : ""}`;

  const res = await sendMail({
    to,
    toName: name || undefined,
    templateSlug: `concierge_${item.status}`,
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    subject: `${fr ? "Conciergerie" : "Concierge"}: ${item.label.replace(/^Restaurant — /, "")} — ${
      fr
        ? { confirmed: "confirmé", declined: "non disponible", cancelled: "annulé" }[item.status]
        : { confirmed: "confirmed", declined: "unavailable", cancelled: "cancelled" }[item.status]
    }`,
    html,
  });
  return res.sent;
}
