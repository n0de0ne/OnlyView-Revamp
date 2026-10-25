import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendMail } from "./mailer";
import { emailTexts, renderEmail } from "./email-templates";
import { getSettings } from "./settings";
import { getContact, ownerNotifyEmail } from "./contact";
import { portalUrlFor } from "./guest-stay";
import { confirmedExtrasTotal } from "./extras";
import { addDays, formatDate, fromISODate, toISODate } from "./dates";
import { audit } from "./audit";
import { siteUrl } from "./seo";

/**
 * Automatic reminders — run every hour by the in-process scheduler
 * (src/instrumentation.ts) or by an external cron hitting /api/cron/reminders.
 *
 * Every message is claimed in ReminderLog before it is sent (unique on
 * reservation + kind), and each kind carries the date it is about
 * ("balance_due:2027-01-15"), so a reminder goes out once per due date —
 * and again if the owner moves the date.
 *
 * Guest-facing messages only go to direct bookings: an agency collects its
 * own payments and owns the relationship with its client.
 */

/** Balance is due this many days before arrival (contract terms). */
export const BALANCE_DUE_DAYS = 30;

/** St Barth calendar day — the server clock is UTC, four hours ahead. */
export function villaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/St_Barthelemy",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export interface ReminderConfig {
  enabled: boolean;
  option: boolean;
  optionRelease: boolean;
  balance: boolean;
  balanceDays: number;
  prearrival: boolean;
  prearrivalDays: number;
  review: boolean;
  reviewDays: number;
}

export async function getReminderConfig(): Promise<ReminderConfig> {
  const s = await getSettings();
  const on = (k: string, dflt = true) => (s[k] == null || s[k].trim() === "" ? dflt : s[k].trim() === "1");
  const int = (k: string, dflt: number) => {
    const n = parseInt(s[k] ?? "", 10);
    return Number.isFinite(n) && n >= 0 && n <= 120 ? n : dflt;
  };
  return {
    enabled: on("reminders_enabled", false),
    option: on("reminder_option"),
    optionRelease: on("reminder_option_release"),
    balance: on("reminder_balance"),
    balanceDays: int("reminder_balance_days", 7),
    prearrival: on("reminder_prearrival"),
    prearrivalDays: int("reminder_prearrival_days", 10),
    review: on("reminder_review"),
    reviewDays: int("reminder_review_days", 2),
  };
}

export interface ReminderAction {
  reservationId: number;
  clientName: string | null;
  kind: string;
  /** who receives it ("owner" or the guest's address) */
  to: string;
  description: string;
}

type Res = Prisma.ReservationGetPayload<{
  include: { client: true; payments: true; extras: true };
}>;

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US") + " USD";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function guestOf(r: Res) {
  const email = r.email ?? r.client?.email ?? null;
  const fr = r.client?.language === "fr";
  const name =
    r.client?.firstname ||
    r.clientName?.split(" ")[0] ||
    (fr ? "cher client" : "dear guest");
  // raw: the email templates escape what they insert
  return { email, fr, name };
}

/** What is still owed on the stay (rental + confirmed extras − money received). */
export function remainingBalance(r: Res): number {
  const ledger = r.payments.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);
  // legacy stays carry only the "deposit received" tick, no ledger rows
  const paid = r.payments.length === 0 && r.depositReceived ? r.depositAmount : ledger;
  return Math.max(0, Math.round(r.priceTTC + confirmedExtrasTotal(r.extras) - paid));
}

const button = (href: string, label: string) =>
  `<p style="text-align:center;margin:24px 0;"><a href="${href}" style="background:#1B4965;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">${label}</a></p>`;

async function bankBlock(fr: boolean): Promise<string> {
  const s = await getSettings();
  const rows = [
    [fr ? "Titulaire" : "Account holder", s.bank_account_name],
    [fr ? "Banque" : "Bank", s.bank_name],
    ["IBAN", s.bank_iban],
    ["BIC / SWIFT", s.bank_bic],
    [fr ? "Compte" : "Account", s.bank_account_number],
  ].filter(([, v]) => v && v.trim());
  if (!rows.length) return "";
  return `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;font-size:14px;margin:16px 0;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;color:#64748b;">${k}</td><td style="padding:6px 10px;font-weight:600;">${esc(v!)}</td></tr>`
    )
    .join("")}</table>`;
}

interface Job {
  kind: string;
  to: "owner" | "guest";
  description: string;
  run: () => Promise<void>;
}

/** Everything due for one stay today, in the order it should happen. */
async function jobsFor(r: Res, today: string, cfg: ReminderConfig): Promise<Job[]> {
  const jobs: Job[] = [];
  const start = toISODate(r.startDate);
  const end = toISODate(r.endDate);
  const g = guestOf(r);
  const direct = r.agencyId == null;
  const guestOk = direct && !!g.email;
  const stayLine = (fr: boolean) =>
    `${formatDate(start, fr ? "fr" : "en")} → ${formatDate(end, fr ? "fr" : "en")}`;

  // ── options ──
  if (cfg.option && r.status === "option" && r.optionExpires && start > today) {
    const exp = toISODate(r.optionExpires);
    if (guestOk && (exp === today || exp === addDays(today, 1))) {
      jobs.push({
        kind: `option_expiring:${exp}`,
        to: "guest",
        description: `Rappel au client : option valable jusqu'au ${exp}`,
        run: async () => {
          const L = g.fr ? "fr" : "en";
          const [portal, t] = await Promise.all([portalUrlFor(r.id, L), emailTexts("optionExpiring", L)]);
          const mail = await renderEmail(
            "optionExpiring",
            L,
            { name: g.name, stay: stayLine(g.fr), expires: formatDate(exp, L) },
            { button: portal ? button(portal, t.button) : "" }
          );
          await sendMail({
            to: g.email!,
            templateSlug: "option_expiring",
            reservationId: r.id,
            clientId: r.clientId ?? undefined,
            subject: mail.subject,
            html: mail.html,
          });
        },
      });
    }
    if (exp < today) {
      jobs.push({
        kind: `option_expired:${exp}`,
        to: "owner",
        description: cfg.optionRelease
          ? `Option expirée le ${exp} → annulée, dates libérées`
          : `Option expirée le ${exp} → alerte (dates toujours bloquées)`,
        run: async () => {
          if (cfg.optionRelease) {
            await prisma.reservation.update({ where: { id: r.id }, data: { status: "cancelled" } });
            await audit({
              action: "option_auto_released",
              entityType: "reservation",
              entityId: r.id,
              details: { optionExpires: exp },
              username: "automation",
            });
          }
          await sendMail({
            to: await ownerNotifyEmail(),
            templateSlug: "admin_option_expired",
            reservationId: r.id,
            subject: `${cfg.optionRelease ? "Option released" : "Option expired"} — ${r.clientName ?? "?"} · ${start} → ${end}`,
            html: `<p>The option of <strong>${esc(r.clientName ?? "?")}</strong> (${start} → ${end}) expired on ${exp}.</p>
<p>${cfg.optionRelease ? "It has been set to <strong>cancelled</strong> and the dates are available again. Re-open it in the editor if that was a mistake." : "The dates are still blocked — confirm, extend or cancel it."}</p>
<p><a href="${siteUrl(`/admin/reservations/${r.id}`)}">Open the reservation</a></p>`,
          });
        },
      });
    }
  }

  if (r.status !== "confirmed") return jobs;

  // ── balance ──
  const due = addDays(start, -BALANCE_DUE_DAYS);
  const remaining = remainingBalance(r);
  if (cfg.balance && !r.balanceReceived && remaining > 0 && start > today) {
    if (guestOk && today >= addDays(due, -cfg.balanceDays) && today <= due) {
      jobs.push({
        kind: `balance_due:${due}`,
        to: "guest",
        description: `Rappel du solde au client : ${money(remaining)} avant le ${due}`,
        run: async () => {
          const L = g.fr ? "fr" : "en";
          const [portal, t, bank] = await Promise.all([portalUrlFor(r.id, L), emailTexts("balanceReminder", L), bankBlock(g.fr)]);
          const mail = await renderEmail(
            "balanceReminder",
            L,
            { name: g.name, stay: stayLine(g.fr), amount: money(remaining), due: formatDate(due, L) },
            { bank, button: portal ? button(portal, t.button) : "" }
          );
          await sendMail({
            to: g.email!,
            templateSlug: "balance_reminder",
            reservationId: r.id,
            clientId: r.clientId ?? undefined,
            subject: mail.subject,
            html: mail.html,
          });
        },
      });
    }
    if (today > due) {
      jobs.push({
        kind: `balance_overdue:${due}`,
        to: "owner",
        description: `Alerte : solde de ${money(remaining)} en retard (échéance ${due})`,
        run: async () => {
          await sendMail({
            to: await ownerNotifyEmail(),
            templateSlug: "admin_balance_overdue",
            reservationId: r.id,
            subject: `Balance overdue — ${r.clientName ?? "?"} · ${start} → ${end}`,
            html: `<p>The balance of <strong>${esc(r.clientName ?? "?")}</strong> (${start} → ${end}) was due on ${due} and is not marked as received.</p>
<p>Still owed: <strong>${money(remaining)}</strong>${r.agencyId ? " (agency booking — check with the agency)" : ""}.</p>
<p><a href="${siteUrl(`/admin/reservations/${r.id}`)}">Open the reservation</a></p>`,
          });
        },
      });
    }
  }

  // ── before arrival ──
  if (
    cfg.prearrival &&
    guestOk &&
    today >= addDays(start, -cfg.prearrivalDays) &&
    today < start
  ) {
    jobs.push({
      kind: `pre_arrival:${start}`,
      to: "guest",
      description: `Email avant l'arrivée (${start})`,
      run: async () => {
        const [portal, contact, s] = await Promise.all([
          portalUrlFor(r.id, g.fr ? "fr" : "en"),
          getContact(),
          getSettings(),
        ]);
        const address = s.villa_address?.trim();
        const early = r.earlyCheckin && r.arrivalTime;
        const late = r.lateCheckout && r.departureTime;
        const practical = [
          address && `${g.fr ? "Adresse" : "Address"} : ${esc(address)} — <a href="${contact.mapUrl}">Google Maps</a>`,
          early && (g.fr ? `Arrivée anticipée confirmée : ${esc(r.arrivalTime!)}` : `Early check-in confirmed: ${esc(r.arrivalTime!)}`),
          late && (g.fr ? `Départ tardif confirmé : ${esc(r.departureTime!)}` : `Late check-out confirmed: ${esc(r.departureTime!)}`),
          contact.whatsappUrl &&
            `WhatsApp : <a href="${contact.whatsappUrl}">${esc(contact.whatsapp)}</a>`,
        ].filter(Boolean);
        const L = g.fr ? "fr" : "en";
        const t = await emailTexts("preArrival", L);
        const mail = await renderEmail(
          "preArrival",
          L,
          { name: g.name, stay: stayLine(g.fr), arrivalDetails: r.guestDetailsUpdatedAt ? t.thanksDetails : t.askDetails },
          {
            button: portal ? button(portal, t.button) : "",
            practical: practical.length ? `<ul>${practical.map((p) => `<li>${p}</li>`).join("")}</ul>` : "",
          }
        );
        await sendMail({
          to: g.email!,
          templateSlug: "pre_arrival",
          reservationId: r.id,
          clientId: r.clientId ?? undefined,
          subject: mail.subject,
          html: mail.html,
        });
      },
    });
  }

  // ── after the stay ──
  const reviewDay = addDays(end, cfg.reviewDays);
  if (cfg.review && guestOk && today >= reviewDay && today <= addDays(reviewDay, 5)) {
    jobs.push({
      kind: `review_request:${end}`,
      to: "guest",
      description: `Demande d'avis (départ ${end})`,
      run: async () => {
        const url = siteUrl(g.fr ? "/fr/reviews" : "/reviews");
        const L = g.fr ? "fr" : "en";
        const t = await emailTexts("reviewRequest", L);
        const mail = await renderEmail("reviewRequest", L, { name: g.name }, { button: button(url, t.button) });
        await sendMail({
          to: g.email!,
          templateSlug: "review_request",
          reservationId: r.id,
          clientId: r.clientId ?? undefined,
          subject: mail.subject,
          html: mail.html,
        });
      },
    });
  }

  return jobs;
}

/**
 * Find (and unless `dryRun`, send) every reminder due today.
 * Returns what was — or would be — done.
 */
export async function runReminders(opts: { dryRun?: boolean; now?: Date } = {}): Promise<{
  enabled: boolean;
  today: string;
  actions: ReminderAction[];
}> {
  const cfg = await getReminderConfig();
  const today = villaToday(opts.now);
  const horizon = fromISODate(addDays(today, BALANCE_DUE_DAYS + 120));
  const lookback = fromISODate(addDays(today, -(cfg.reviewDays + 6)));

  const stays = await prisma.reservation.findMany({
    where: {
      isArchived: false,
      status: { in: ["option", "confirmed"] },
      startDate: { lt: horizon },
      endDate: { gte: lookback },
    },
    include: { client: true, payments: true, extras: true, reminders: true },
    orderBy: { startDate: "asc" },
  });

  const actions: ReminderAction[] = [];
  for (const r of stays) {
    const done = new Set(r.reminders.map((x) => x.kind));
    for (const job of await jobsFor(r, today, cfg)) {
      if (done.has(job.kind)) continue;
      const action: ReminderAction = {
        reservationId: r.id,
        clientName: r.clientName,
        kind: job.kind,
        to: job.to === "owner" ? "owner" : (guestOf(r).email ?? "?"),
        description: job.description,
      };
      if (opts.dryRun) {
        actions.push(action);
        continue;
      }
      // claim first: a concurrent run (or a second instance) loses the race
      try {
        await prisma.reminderLog.create({ data: { reservationId: r.id, kind: job.kind } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
      try {
        await job.run();
        actions.push(action);
      } catch (e) {
        // release the claim so the next run retries
        await prisma.reminderLog
          .delete({ where: { reservationId_kind: { reservationId: r.id, kind: job.kind } } })
          .catch(() => null);
        console.error("[reminders]", job.kind, r.id, e);
      }
    }
  }
  return { enabled: cfg.enabled, today, actions };
}
