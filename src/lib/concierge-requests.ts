import "server-only";
import type { ReservationExtra } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { emailButton, emailNote, emailTexts, renderEmail } from "./email-templates";
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

  // wording: Admin → Textes du site → Emails
  const t = await emailTexts("conciergeAnswer", L);
  const st = item.status as "confirmed" | "declined" | "cancelled";
  const pick = ({ confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" } as const)[st] ?? "Cancelled";
  const status = t[`status${pick}` as const];
  const color = confirmed ? "#2e7d5b" : "#8a8a8a";
  const request = `<p style="border:1px solid #e5e5e5;padding:14px 18px;">
<strong>${esc(item.label)}</strong><br>
${esc(when)}<br>
<span style="color:${color};font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">${esc(status)}</span>
</p>`;
  const mail = await renderEmail(
    "conciergeAnswer",
    L,
    {
      name,
      verdict: t[`verdict${pick}` as const],
      status: status.toLowerCase(),
      request: item.label.replace(/^Restaurant — /, ""),
      otherOption: confirmed ? "" : t.otherOption,
    },
    {
      request,
      note: emailNote(item.adminNote),
      button: portal ? emailButton(portal, t.button, "#1B4965") : "",
    }
  );

  const res = await sendMail({
    to,
    toName: name || undefined,
    templateSlug: `concierge_${item.status}`,
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    subject: mail.subject,
    html: mail.html,
  });
  return res.sent;
}
