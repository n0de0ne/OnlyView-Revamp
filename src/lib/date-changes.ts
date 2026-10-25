import { rentDue } from "./payment-summary";
import "server-only";
import type { DateChange, Reservation, ReservationPeriod } from "@prisma/client";
import { prisma } from "./db";
import { computeQuote, type PeriodInput } from "./pricing";
import { getRateConfig } from "./settings";
import { isRangeAvailable } from "./availability";
import { formatDate, nightsBetween, toISODate, todayISO } from "./dates";
import { sendMail } from "./mailer";
import { emailButton, emailNote, emailTexts, renderEmail, renderEmailText } from "./email-templates";
import { hasPriorAgreement, issueContract, loadReservationForContract } from "./contracts";
import { portalUrlFor } from "./guest-stay";

export const DATE_CHANGE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US") + " USD";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function serializeDateChange(d: DateChange) {
  return {
    id: d.id,
    source: d.source,
    status: d.status,
    fromStart: toISODate(d.fromStart),
    fromEnd: toISODate(d.fromEnd),
    toStart: toISODate(d.toStart),
    toEnd: toISODate(d.toEnd),
    previousTTC: d.previousTTC,
    quotedTTC: d.quotedTTC,
    message: d.message,
    adminNote: d.adminNote,
    decidedAt: d.decidedAt?.toISOString() ?? null,
    decidedBy: d.decidedBy,
    contractId: d.contractId,
    createdAt: d.createdAt.toISOString(),
  };
}

export type SerializedDateChange = ReturnType<typeof serializeDateChange>;

/**
 * Rent for the stay moved to other dates, with every pricing option the stay
 * already has (rate, discount, offered bedroom, free nights, tax). Null when
 * the owner priced it by hand — a manual final price or variable periods.
 */
export async function priceForDates(
  r: Reservation & { periods?: ReservationPeriod[] },
  startDate: string,
  endDate: string
) {
  const rates = await getRateConfig();
  const quote = computeQuote(
    {
      startDate,
      endDate,
      bedrooms: r.bedrooms,
      periods: [] as PeriodInput[],
      customWeeklyRate: r.customWeeklyRate,
      offerOneRoom: r.offerOneRoom,
      freeNights: r.freeNights,
      discountPercent: r.discountPercent,
      noTax: r.noTax,
      agencyFeePercent: r.agencyFeePercent,
    },
    rates
  );
  const manual = r.finalPriceOverride != null || (r.periods?.length ?? 0) > 0;
  return { quote, estimable: !manual };
}

export type DateCheck =
  | { ok: true; nights: number; quotedTTC: number | null; minStayOk: boolean; minStayRequired: number }
  | { ok: false; error: "invalid_dates" | "same_dates" | "too_long" | "past_dates" | "dates_unavailable" };

/** Can the stay move to these dates? (guest preview, guest request, owner approval) */
export async function checkNewDates(
  r: Reservation & { periods?: ReservationPeriod[] },
  startDate: string,
  endDate: string
): Promise<DateCheck> {
  if (endDate <= startDate) return { ok: false, error: "invalid_dates" };
  if (startDate < todayISO()) return { ok: false, error: "past_dates" };
  if (nightsBetween(startDate, endDate) > 90) return { ok: false, error: "too_long" };
  if (startDate === toISODate(r.startDate) && endDate === toISODate(r.endDate)) {
    return { ok: false, error: "same_dates" };
  }
  if (!(await isRangeAvailable(startDate, endDate, r.id))) return { ok: false, error: "dates_unavailable" };
  const { quote, estimable } = await priceForDates(r, startDate, endDate);
  return {
    ok: true,
    nights: quote.nights,
    quotedTTC: estimable ? quote.totalTTC : null,
    minStayOk: quote.minStayOk,
    minStayRequired: quote.minStayRequired,
  };
}

/** Log a change of dates the owner made in the editor, so the next contract is an amendment. */
export async function recordOwnerDateChange(
  before: Pick<Reservation, "id" | "startDate" | "endDate" | "priceTTC" | "status">,
  after: { startDate: string; endDate: string; priceTTC: number },
  username: string
) {
  if (toISODate(before.startDate) === after.startDate && toISODate(before.endDate) === after.endDate) return;
  if (!["option", "confirmed"].includes(before.status)) return;
  // every move is logged; whether the next contract is an amendment is
  // decided when it is issued (a contract was sent or money was received)
  await prisma.dateChange.create({
    data: {
      reservationId: before.id,
      source: "admin",
      status: "approved",
      fromStart: before.startDate,
      fromEnd: before.endDate,
      toStart: day(after.startDate),
      toEnd: day(after.endDate),
      previousTTC: before.priceTTC,
      quotedTTC: after.priceTTC,
      decidedAt: new Date(),
      decidedBy: username,
    },
  });
}

function guestOf(r: Reservation & { client: { email: string | null; firstname: string; lastname: string; language: string } | null }) {
  return {
    to: r.email ?? r.client?.email ?? null,
    name: r.clientName ?? `${r.client?.firstname ?? ""} ${r.client?.lastname ?? ""}`.trim(),
    fr: r.client?.language === "fr",
  };
}

export type DecisionResult =
  | { ok: true; contractId: number | null; signUrl: string | null; emailSent: boolean }
  | { ok: false; error: string; status?: number };

/**
 * The owner's answer to a guest's request. Approving moves the stay, reprices
 * it with its own options, and by default issues the amendment (released
 * dates, amounts received, balance) — the guest is emailed either way.
 */
export async function decideDateChange(
  changeId: number,
  decision: {
    action: "approve" | "reject";
    note?: string | null;
    issueAmendment?: boolean;
    notifyGuest?: boolean;
  },
  username: string
): Promise<DecisionResult> {
  const change = await prisma.dateChange.findUnique({
    where: { id: changeId },
    include: { reservation: { include: { periods: true, client: true } } },
  });
  if (!change) return { ok: false, error: "not_found", status: 404 };
  if (change.status !== "pending") return { ok: false, error: "already_decided", status: 409 };
  const r = change.reservation;
  const note = decision.note?.trim() || null;
  const toStart = toISODate(change.toStart);
  const toEnd = toISODate(change.toEnd);

  if (decision.action === "reject") {
    await prisma.dateChange.update({
      where: { id: changeId },
      data: { status: "rejected", adminNote: note, decidedAt: new Date(), decidedBy: username },
    });
    const emailSent = decision.notifyGuest === false ? false : await emailGuestDecision(change.id);
    return { ok: true, contractId: null, signUrl: null, emailSent };
  }

  // approve
  if (r.periods.length) return { ok: false, error: "has_periods", status: 409 };
  if (toISODate(r.startDate) !== toISODate(change.fromStart) || toISODate(r.endDate) !== toISODate(change.fromEnd)) {
    return { ok: false, error: "stay_changed", status: 409 };
  }
  if (!(await isRangeAvailable(toStart, toEnd, r.id))) return { ok: false, error: "dates_unavailable", status: 409 };

  const { quote } = await priceForDates(r, toStart, toEnd);
  const paid = await prisma.payment.findMany({ where: { reservationId: r.id } });
  const paidTotal = paid.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);
  // keep a deposit the guest already paid; an unpaid one follows the new rent
  const depositAmount = r.depositReceived ? r.depositAmount : quote.depositAmount;
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      startDate: day(toStart),
      endDate: day(toEnd),
      priceHT: quote.finalHT,
      taxAmount: quote.taxAmount,
      priceTTC: quote.totalTTC,
      depositAmount,
      balanceReceived: paid.length
        ? quote.totalTTC > 0 && paidTotal >= rentDue(quote.totalTTC, r.agencyId ? r.agencyFeePercent : 0) - 0.01
        : r.balanceReceived,
    },
  });
  await prisma.dateChange.update({
    where: { id: changeId },
    data: {
      status: "approved",
      adminNote: note,
      quotedTTC: quote.totalTTC,
      decidedAt: new Date(),
      decidedBy: username,
    },
  });

  let contractId: number | null = null;
  let signUrl: string | null = null;
  const after = await loadReservationForContract(r.id);
  if (decision.issueAmendment !== false && after && hasPriorAgreement(after)) {
    const issued = await issueContract(r.id);
    if (issued.ok) {
      contractId = issued.contract.id;
      signUrl = issued.signUrl;
    }
  }
  const emailSent = decision.notifyGuest === false ? false : await emailGuestDecision(change.id, signUrl);
  return { ok: true, contractId, signUrl, emailSent };
}

/** Tell the guest what the owner decided (with the amendment to sign, when one was issued). */
async function emailGuestDecision(changeId: number, signUrl: string | null = null): Promise<boolean> {
  const c = await prisma.dateChange.findUnique({
    where: { id: changeId },
    include: { reservation: { include: { client: true } } },
  });
  if (!c) return false;
  const r = c.reservation;
  const g = guestOf(r);
  if (!g.to) return false;
  const L = g.fr ? "fr" : "en";
  const from = `${formatDate(c.fromStart, L)} – ${formatDate(c.fromEnd, L)}`;
  const to = `${formatDate(c.toStart, L)} – ${formatDate(c.toEnd, L)}`;
  const approved = c.status === "approved";
  const portal = await portalUrlFor(r.id, L);
  // wording: Admin → Textes du site → Emails
  const key = approved ? "dateChangeApproved" : "dateChangeRejected";
  const t = await emailTexts(key, L);
  const blocks: Record<string, string> = {
    note: emailNote(c.adminNote),
    button: portal ? emailButton(portal, t.button, "#1B4965") : "",
  };
  if (approved) {
    const a = t as Awaited<ReturnType<typeof emailTexts<"dateChangeApproved">>>;
    blocks.amendment = signUrl ? renderEmailText(a.amendment, {}) + emailButton(signUrl, a.amendmentButton) : "";
  }
  const mail = await renderEmail(key, L, { name: g.name, from, to, amount: money(r.priceTTC) }, blocks);

  const res = await sendMail({
    to: g.to,
    toName: g.name,
    templateSlug: approved ? "date_change_approved" : "date_change_rejected",
    reservationId: r.id,
    clientId: r.clientId ?? undefined,
    subject: mail.subject,
    html: mail.html,
  });
  return res.sent;
}
