import "server-only";
import { prisma } from "./db";
import { sendMail } from "./mailer";
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

  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 10px;color:#64748b;">${k}</td><td style="padding:6px 10px;font-weight:600;">${v}</td></tr>`;
  const details =
    lang === "fr"
      ? row("Arrivée", formatDate(checkIn, "fr")) +
        row("Départ", formatDate(checkOut, "fr")) +
        row("Durée", `${nights} nuits`) +
        row("Chambres", String(r.bedrooms)) +
        row("Personnes", String(r.guests)) +
        (r.priceTTC > 0 ? row("Montant total", money(r.priceTTC)) : "")
      : row("Arrival", formatDate(checkIn, "en")) +
        row("Departure", formatDate(checkOut, "en")) +
        row("Duration", `${nights} nights`) +
        row("Bedrooms", String(r.bedrooms)) +
        row("Guests", String(r.guests)) +
        (r.priceTTC > 0 ? row("Total amount", money(r.priceTTC)) : "");
  const table = `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;font-size:14px;margin:16px 0;">${details}</table>`;

  const html =
    lang === "fr"
      ? `<p>Cher(e) <strong>${name}</strong>,</p>
<p>Bonne nouvelle ! Votre réservation à la Villa ONLY VIEW est confirmée.</p>
${table}
<p>Nous avons hâte de vous accueillir dans notre belle villa à Saint-Barthélemy.</p>
<p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
<p>Cordialement,<br>L'équipe Villa ONLY VIEW</p>`
      : `<p>Dear <strong>${name}</strong>,</p>
<p>Great news! Your reservation at Villa ONLY VIEW has been confirmed.</p>
${table}
<p>We look forward to welcoming you to our beautiful villa in Saint-Barthélemy.</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Warm regards,<br>The Villa ONLY VIEW Team</p>`;

  const res = await sendMail({
    to,
    toName: name,
    templateSlug: "booking_confirmed",
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    subject:
      lang === "fr"
        ? "Votre réservation à la Villa ONLY VIEW est confirmée !"
        : "Your booking at Villa ONLY VIEW is confirmed!",
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
