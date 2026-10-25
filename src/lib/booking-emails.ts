import "server-only";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { emailTable, renderEmail } from "./email-templates";
import { formatDate, toISODate, nightsBetween } from "./dates";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US") + " USD";

/**
 * Booking confirmation to the client — the legacy `booking_confirmed`
 * template, sent when the owner confirms a reservation and asks for it
 * (opt-in checkbox in the editor, or the "resend" button).
 */
export async function sendBookingConfirmation(
  reservationId: number,
  opts: { force?: boolean } = {}
): Promise<{ sent: boolean; queued: boolean; skipped?: "no_email" | "already_sent" | "not_found" }> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { client: true },
  });
  if (!r) return { sent: false, queued: false, skipped: "not_found" };
  if (r.confirmationEmailSent && !opts.force) {
    return { sent: false, queued: false, skipped: "already_sent" };
  }
  const to = r.email ?? r.client?.email ?? null;
  if (!to) return { sent: false, queued: false, skipped: "no_email" };

  const name =
    r.clientName ||
    `${r.client?.firstname ?? ""} ${r.client?.lastname ?? ""}`.trim() ||
    (r.client?.language === "fr" ? "cher client" : "valued guest");
  const lang = r.client?.language === "fr" ? "fr" : "en";
  const checkIn = toISODate(r.startDate);
  const checkOut = toISODate(r.endDate);
  const nights = nightsBetween(checkIn, checkOut);

  const L = lang === "fr";
  const details = emailTable([
    [L ? "Arrivée" : "Arrival", formatDate(checkIn, lang)],
    [L ? "Départ" : "Departure", formatDate(checkOut, lang)],
    [L ? "Durée" : "Duration", `${nights} ${L ? "nuits" : "nights"}`],
    [L ? "Chambres" : "Bedrooms", String(r.bedrooms)],
    [L ? "Personnes" : "Guests", String(r.guests)],
    ...(r.priceTTC > 0 ? [[L ? "Montant total" : "Total amount", money(r.priceTTC)] as [string, string]] : []),
  ]);
  // wording: Admin → Textes du site → Emails
  const { subject, html } = await renderEmail("bookingConfirmed", lang, { name }, { details });

  const res = await sendMail({
    to,
    toName: name,
    templateSlug: "booking_confirmed",
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    subject,
    html,
  });

  if (res.sent) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { confirmationEmailSent: true },
    });
  }
  return { sent: res.sent, queued: !res.sent };
}
