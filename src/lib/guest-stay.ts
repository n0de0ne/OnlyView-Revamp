import "server-only";
import type { z } from "zod";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { ownerNotifyEmail } from "./contact";
import { siteUrl } from "./seo";
import { getGuestClientId, newPortalToken } from "./guest-auth";
import type { GuestDetailsInput } from "./admin-schemas";
import { toISODate, todayISO } from "./dates";

type GuestDetails = z.infer<typeof GuestDetailsInput>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const blank = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

/** Persist arrival details — admin editor and guest portal share this. */
export async function saveGuestDetails(reservationId: number, d: GuestDetails) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: {
      arrivalFlight: blank(d.arrivalFlight),
      arrivalEta: blank(d.arrivalEta),
      departureFlight: blank(d.departureFlight),
      departureEta: blank(d.departureEta),
      adults: d.adults ?? null,
      children: d.children ?? null,
      guestNames: blank(d.guestNames),
      specialRequests: blank(d.specialRequests),
      guestDetailsUpdatedAt: new Date(),
    },
  });
}

/** Guest-portal link that signs the guest in (creates the reservation's portal token if needed). */
export async function portalUrlFor(reservationId: number, locale: "en" | "fr" = "en"): Promise<string | null> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { portalToken: true, clientId: true },
  });
  if (!r?.clientId) return null;
  let token = r.portalToken;
  if (!token) {
    token = newPortalToken();
    await prisma.reservation.update({ where: { id: reservationId }, data: { portalToken: token } });
  }
  return siteUrl(`/api/account/login?pt=${token}&locale=${locale}`);
}

/** Tell the owner the guest changed something from the portal. */
export async function notifyOwnerOfGuestUpdate(
  reservationId: number,
  what: { subject: string; lines: string[] }
) {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, clientName: true, startDate: true, endDate: true },
  });
  if (!r) return;
  await sendMail({
    to: await ownerNotifyEmail(),
    templateSlug: "admin_guest_update",
    reservationId: r.id,
    subject: `${what.subject} — ${r.clientName ?? "Guest"} · ${toISODate(r.startDate)} → ${toISODate(r.endDate)}`,
    html: `<h2 style="margin-top:0">${esc(what.subject)}</h2>
<p><strong>${esc(r.clientName ?? "Guest")}</strong> · ${toISODate(r.startDate)} → ${toISODate(r.endDate)}</p>
<ul>${what.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p><a href="${siteUrl(`/admin/reservations/${r.id}`)}">Open the reservation in admin</a></p>`,
  });
}

/**
 * The signed-in guest's own upcoming stay, or null — the portal may only
 * change stays that belong to the guest and haven't ended or been cancelled.
 */
export async function guestEditableReservation(id: number) {
  const clientId = await getGuestClientId();
  if (!clientId || !Number.isFinite(id)) return null;
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r || r.clientId !== clientId) return null;
  if (!["option", "confirmed"].includes(r.status) || r.isArchived) return null;
  if (toISODate(r.endDate) < todayISO()) return null;
  return r;
}
