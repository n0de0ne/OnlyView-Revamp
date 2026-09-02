"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeQuote, type RateConfig } from "@/lib/pricing";
import { addDays, nightsBetween } from "@/lib/dates";
import type { SerializedReservation } from "@/lib/reservations";
import {
  api,
  Card,
  ConfirmButton,
  fmtDate,
  fmtEUR,
  fmtUSD,
  Modal,
  Spinner,
  useToast,
} from "./ui";

interface AgencyOpt {
  id: number;
  name: string;
  commissionPercent: number;
}

interface Costs {
  cleaningPerDayEUR: number;
  fixedMonthlyEUR: number;
  eurUsdRate: number;
}

interface PeriodRow {
  startDate: string;
  endDate: string;
  bedrooms: number;
  weeklyRate: number | null;
}

interface FormState {
  status: string;
  startDate: string;
  endDate: string;
  clientId: number | null;
  clientFirst: string;
  clientLast: string;
  email: string;
  phone: string;
  bedrooms: number;
  guests: number;
  agencyId: number | null;
  agencyFeePercent: number;
  customWeeklyRate: string;
  finalPriceOverride: string;
  discountPercent: number;
  offerOneRoom: boolean;
  freeNights: number;
  noTax: boolean;
  optionExpires: string;
  depositAmount: string;
  depositReceived: boolean;
  balanceReceived: boolean;
  earlyCheckin: boolean;
  arrivalTime: string;
  lateCheckout: boolean;
  departureTime: string;
  notes: string;
  periods: PeriodRow[];
  useVariable: boolean;
}

const EMPTY: FormState = {
  status: "option",
  startDate: "",
  endDate: "",
  clientId: null,
  clientFirst: "",
  clientLast: "",
  email: "",
  phone: "",
  bedrooms: 4,
  guests: 8,
  agencyId: null,
  agencyFeePercent: 0,
  customWeeklyRate: "",
  finalPriceOverride: "",
  discountPercent: 0,
  offerOneRoom: false,
  freeNights: 0,
  noTax: false,
  optionExpires: "",
  depositAmount: "",
  depositReceived: false,
  balanceReceived: false,
  earlyCheckin: false,
  arrivalTime: "",
  lateCheckout: false,
  departureTime: "",
  notes: "",
  periods: [],
  useVariable: false,
};

interface ClientHit {
  id: number;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  isVip: boolean;
  blacklisted: boolean;
  discountPercent: number;
  discountReason?: string | null;
  stats?: { stays: number; nights: number; spent: number };
}

type StatusBtn = [string, string, string];

/** The business uses two statuses, exactly like the PHP admin. */
const STATUS_BTNS: StatusBtn[] = [
  ["option", "🟠 Option", "border-amber-400 bg-amber-50 text-amber-700"],
  ["confirmed", "🔴 Confirmé", "border-red-400 bg-red-50 text-red-700"],
];

/** Statuses that only exist in older rows — shown when set, never offered. */
const LEGACY_STATUS_BTNS: StatusBtn[] = [
  ["pending", "🟣 En attente", "border-violet-400 bg-violet-50 text-violet-700"],
  ["blocked", "⬛ Bloqué", "border-slate-400 bg-slate-100 text-slate-700"],
  ["cancelled", "✖ Annulé", "border-slate-300 bg-white text-slate-400"],
];

export function ReservationEditor({
  reservationId,
  rates,
  agencies,
  costs,
  prefill,
  inModal = false,
  loyaltyEnabled = false,
}: {
  reservationId: number | null;
  rates: RateConfig;
  agencies: AgencyOpt[];
  costs: Costs;
  prefill: { start: string | null; end: string | null };
  /** rendered inside the intercepted route overlay — the modal owns the title bar */
  inModal?: boolean;
  /** loyalty programme switched on in Réglages */
  loyaltyEnabled?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [loaded, setLoaded] = useState<SerializedReservation | null>(null);
  const [loading, setLoading] = useState(reservationId != null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    startDate: prefill.start ?? "",
    endDate: prefill.end ?? "",
  });
  const depositTouched = useRef(false);
  const [showProfit, setShowProfit] = useState(false);
  const [payModal, setPayModal] = useState(false);
  // opt-in, like the legacy "envoyer l'email de confirmation" checkbox
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [payForm, setPayForm] = useState({
    kind: "deposit",
    amount: "",
    method: "wire",
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // client autocomplete
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [linkedClient, setLinkedClient] = useState<ClientHit | null>(null);

  // agencies (server list + any created from here, like the legacy "Autre…")
  const [agencyList, setAgencyList] = useState<AgencyOpt[]>(agencies);
  const [newAgency, setNewAgency] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Arrival picked → a week's stay by default, like the PHP admin: the
      departure follows only when it is empty or no longer after the arrival. */
  const setStartDate = (value: string) =>
    setForm((f) => ({
      ...f,
      startDate: value,
      endDate: value && (!f.endDate || f.endDate <= value) ? addDays(value, 7) : f.endDate,
    }));

  /* ── load ── */
  const load = useCallback(async () => {
    if (reservationId == null) return;
    setLoading(true);
    const res = await api<{ reservation: SerializedReservation }>(
      `/api/admin/reservations/${reservationId}`
    );
    if (res.success && res.reservation) {
      const r = res.reservation;
      setLoaded(r);
      const [first, ...rest] = (r.clientName ?? "").split(" ");
      setForm({
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        clientId: r.clientId,
        clientFirst: r.client?.firstname ?? first ?? "",
        clientLast: r.client?.lastname ?? rest.join(" "),
        email: r.email ?? r.client?.email ?? "",
        phone: r.phone ?? r.client?.phone ?? "",
        bedrooms: r.bedrooms,
        guests: r.guests,
        agencyId: r.agencyId,
        agencyFeePercent: r.agencyFeePercent,
        customWeeklyRate: r.customWeeklyRate != null ? String(r.customWeeklyRate) : "",
        finalPriceOverride: r.finalPriceOverride != null ? String(r.finalPriceOverride) : "",
        discountPercent: r.discountPercent,
        offerOneRoom: r.offerOneRoom,
        freeNights: r.freeNights,
        noTax: r.noTax,
        optionExpires: r.optionExpires ?? "",
        depositAmount: r.depositAmount ? String(r.depositAmount) : "",
        depositReceived: r.depositReceived,
        balanceReceived: r.balanceReceived,
        earlyCheckin: r.earlyCheckin,
        arrivalTime: r.arrivalTime ?? "",
        lateCheckout: r.lateCheckout,
        departureTime: r.departureTime ?? "",
        notes: r.notes ?? "",
        periods: r.periods.map((p) => ({
          startDate: p.startDate,
          endDate: p.endDate,
          bedrooms: p.bedrooms,
          weeklyRate: p.weeklyRate,
        })),
        useVariable: r.periods.length > 0,
      });
      depositTouched.current = true;
      if (r.client) {
        setLinkedClient({
          id: r.client.id,
          firstname: r.client.firstname,
          lastname: r.client.lastname,
          email: r.client.email,
          phone: r.client.phone,
          isVip: r.client.isVip,
          blacklisted: r.client.blacklisted,
          discountPercent: r.client.discountPercent,
          discountReason: r.client.discountReason,
        });
      }
    }
    setLoading(false);
  }, [reservationId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── live quote (same engine as the server) ── */
  const quote = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate <= form.startDate) return null;
    return computeQuote(
      {
        startDate: form.startDate,
        endDate: form.endDate,
        bedrooms: form.bedrooms,
        periods: form.useVariable ? form.periods.filter((p) => p.startDate && p.endDate) : [],
        customWeeklyRate: form.customWeeklyRate ? parseFloat(form.customWeeklyRate) : null,
        offerOneRoom: form.offerOneRoom,
        freeNights: form.freeNights,
        discountPercent: form.discountPercent,
        finalPriceOverride: form.finalPriceOverride ? parseFloat(form.finalPriceOverride) : null,
        noTax: form.noTax,
        agencyFeePercent: form.agencyFeePercent,
      },
      rates
    );
  }, [form, rates]);

  // auto deposit 30% (direct bookings) until manually edited
  useEffect(() => {
    if (!quote || depositTouched.current) return;
    set("depositAmount", quote.depositAmount ? String(quote.depositAmount) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.depositAmount]);

  /* ── profitability (port of the PHP analysis panel) ── */
  const profitability = useMemo(() => {
    if (!quote || quote.nights === 0) return null;
    const netUSD = quote.netRevenue;
    const netEUR = netUSD / costs.eurUsdRate;
    const cleaning = costs.cleaningPerDayEUR * quote.nights;
    const fixed = (costs.fixedMonthlyEUR / 30) * quote.nights;
    const totalCosts = cleaning + fixed;
    const margin = netEUR - totalCosts;
    return {
      netUSD,
      netEUR,
      cleaning,
      fixed,
      totalCosts,
      costPerNight: totalCosts / quote.nights,
      margin,
      marginPercent: netEUR > 0 ? (margin / netEUR) * 100 : 0,
    };
  }, [quote, costs]);

  /* ── client search ── */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchClients = (q: string) => {
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const res = await api<{ clients: ClientHit[] }>(
        `/api/admin/clients?q=${encodeURIComponent(q)}`
      );
      if (res.success) {
        setHits(res.clients);
        setShowHits(true);
      }
    }, 220);
  };

  const pickClient = (c: ClientHit) => {
    setLinkedClient(c);
    setForm((f) => ({
      ...f,
      clientId: c.id,
      clientFirst: c.firstname,
      clientLast: c.lastname,
      email: c.email ?? f.email,
      phone: c.phone ?? f.phone,
    }));
    setShowHits(false);
  };

  const unlinkClient = () => {
    setLinkedClient(null);
    set("clientId", null);
  };

  /* ── variable periods helpers ── */
  const addPeriod = () => {
    const last = form.periods.at(-1);
    const start = last?.endDate || form.startDate;
    setForm((f) => ({
      ...f,
      useVariable: true,
      periods: [
        ...f.periods,
        {
          startDate: start,
          endDate: f.endDate && start < f.endDate ? f.endDate : start,
          bedrooms: f.bedrooms,
          weeklyRate: null,
        },
      ],
    }));
  };

  const setPeriod = (i: number, patch: Partial<PeriodRow>) =>
    setForm((f) => ({
      ...f,
      periods: f.periods.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));

  const coveredNights = useMemo(() => {
    if (!form.useVariable || !form.startDate || !form.endDate) return null;
    const total = nightsBetween(form.startDate, form.endDate);
    let covered = 0;
    for (const p of form.periods) {
      if (!p.startDate || !p.endDate || p.endDate <= p.startDate) continue;
      const s = p.startDate < form.startDate ? form.startDate : p.startDate;
      const e = p.endDate > form.endDate ? form.endDate : p.endDate;
      if (e > s) covered += nightsBetween(s, e);
    }
    return { total, covered, uncovered: Math.max(0, total - covered) };
  }, [form.useVariable, form.periods, form.startDate, form.endDate]);

  /* ── save ── */
  const save = async () => {
    if (!form.startDate || !form.endDate) {
      push("Dates requises", "error");
      return;
    }
    setSaving(true);
    const clientName = `${form.clientFirst} ${form.clientLast}`.trim() || null;
    const payload = {
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      clientId: form.clientId,
      clientName,
      email: form.email || null,
      phone: form.phone || null,
      bedrooms: form.bedrooms,
      guests: form.guests,
      agencyId: form.agencyId,
      agencyFeePercent: form.agencyFeePercent,
      customWeeklyRate: form.customWeeklyRate ? parseFloat(form.customWeeklyRate) : null,
      finalPriceOverride: form.finalPriceOverride ? parseFloat(form.finalPriceOverride) : null,
      discountPercent: form.discountPercent,
      offerOneRoom: form.offerOneRoom,
      freeNights: form.freeNights,
      noTax: form.noTax,
      optionExpires: form.status === "option" && form.optionExpires ? form.optionExpires : null,
      depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
      depositReceived: form.depositReceived,
      balanceReceived: form.balanceReceived,
      sendConfirmationEmail: sendConfirmation && form.status === "confirmed",
      earlyCheckin: form.earlyCheckin,
      arrivalTime: form.earlyCheckin && form.arrivalTime ? form.arrivalTime : null,
      lateCheckout: form.lateCheckout,
      departureTime: form.lateCheckout && form.departureTime ? form.departureTime : null,
      notes: form.notes || null,
      periods: form.useVariable
        ? form.periods.filter((p) => p.startDate && p.endDate && p.endDate > p.startDate)
        : [],
    };

    const res = reservationId
      ? await api<{ reservation: SerializedReservation }>(
          `/api/admin/reservations/${reservationId}`,
          { method: "PUT", json: payload }
        )
      : await api<{ reservation: SerializedReservation }>(`/api/admin/reservations`, {
          method: "POST",
          json: payload,
        });

    setSaving(false);
    if (res.success) {
      push("Réservation enregistrée");
      if (!reservationId && res.reservation) {
        router.replace(`/admin/reservations/${res.reservation.id}`);
      } else {
        load();
      }
      // keep the calendar/list underneath in sync while the modal stays open
      if (inModal) router.refresh();
    } else {
      push(
        res.error === "dates_conflict"
          ? "Conflit de dates avec une autre réservation"
          : `Erreur : ${res.error}`,
        "error"
      );
    }
  };

  /** "Autre agence…" — create it on the fly and select it, like the PHP modal. */
  const createAgency = async () => {
    const name = (newAgency ?? "").trim();
    if (!name) return setNewAgency(null);
    const existing = agencyList.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setForm((f) => ({
        ...f,
        agencyId: existing.id,
        agencyFeePercent: existing.commissionPercent,
      }));
      setNewAgency(null);
      return;
    }
    const res = await api<{ agency: AgencyOpt }>("/api/admin/agencies", {
      method: "POST",
      json: { name, commissionPercent: form.agencyFeePercent || 20 },
    });
    if (res.success && res.agency) {
      setAgencyList((l) => [...l, res.agency].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({
        ...f,
        agencyId: res.agency.id,
        agencyFeePercent: res.agency.commissionPercent,
      }));
      setNewAgency(null);
      push(`Agence « ${name} » créée`);
    } else {
      push(`Erreur : ${res.error}`, "error");
    }
  };

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!reservationId) return null;
    const res = await api<Record<string, unknown>>(
      `/api/admin/reservations/${reservationId}/actions`,
      { method: "POST", json: { action, ...extra } }
    );
    if (!res.success) push(`Erreur : ${res.error}`, "error");
    return res;
  };

  const remove = async () => {
    if (!reservationId) return;
    const res = await api(`/api/admin/reservations/${reservationId}`, { method: "DELETE" });
    if (res.success) {
      push("Réservation supprimée");
      if (inModal) {
        router.back();
        router.refresh();
      } else {
        router.replace("/admin/reservations");
      }
    }
  };

  const generateContract = async (lang: "fr" | "en", send: boolean) => {
    const res = await doAction(send ? "send-contract" : "generate-contract", { lang });
    if (res?.success) {
      const url = res.signUrl as string;
      if (!send) {
        await navigator.clipboard.writeText(url).catch(() => {});
        push("Contrat généré — lien de signature copié");
      } else {
        push(res.emailSent ? "Contrat envoyé par email" : "Contrat généré (email en file — SMTP non configuré)");
      }
      load();
    }
  };

  const portalLink = async (send: boolean) => {
    const res = await doAction(send ? "send-portal-email" : "portal-link");
    if (res?.success) {
      const url = res.portalUrl as string;
      if (!send) {
        await navigator.clipboard.writeText(url).catch(() => {});
        push("Lien espace client copié");
      } else {
        push(res.emailSent ? "Email espace client envoyé" : "Lien créé (email en file — SMTP non configuré)");
      }
    }
  };

  const addPayment = async () => {
    const amount = parseFloat(payForm.amount);
    if (!amount) return;
    const res = await doAction("add-payment", {
      payment: {
        kind: payForm.kind,
        amount,
        method: payForm.method,
        receivedAt: payForm.receivedAt,
        notes: payForm.notes || null,
      },
    });
    if (res?.success) {
      push("Paiement enregistré");
      setPayModal(false);
      setPayForm({ ...payForm, amount: "", notes: "" });
      load();
    }
  };

  if (loading) return <Spinner />;

  const totalPaid =
    loaded?.payments.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0) ?? 0;
  const latestContract = loaded?.contracts.find((c) => c.status !== "void");

  return (
    <div className={inModal ? "space-y-5" : "mx-auto max-w-5xl space-y-5 pb-24"}>
      {/* Header — in a modal the overlay already shows the title, so only the
          archived flag and the save button are repeated here. */}
      <div
        className={`flex flex-wrap items-center gap-3 ${
          inModal
            ? "sticky top-0 z-20 -mx-4 -mt-5 justify-end border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
            : "justify-between"
        }`}
      >
        {!inModal ? (
          <div>
            <Link href="/admin/reservations" className="text-xs text-slate-400 hover:text-navy">
              ← Réservations
            </Link>
            <h1 className="text-xl font-bold text-slate-800">
              {reservationId ? `Réservation #${reservationId}` : "Nouvelle réservation"}
              {loaded?.isArchived && (
                <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Archivée
                </span>
              )}
            </h1>
          </div>
        ) : (
          <div className="mr-auto flex items-center gap-2 text-xs text-slate-500">
            {loaded?.isArchived && (
              <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-600">
                Archivée
              </span>
            )}
            {form.startDate && form.endDate && (
              <span>
                {fmtDate(form.startDate)} → {fmtDate(form.endDate)}
                {quote && quote.nights > 0 && ` · ${quote.nights} nuits`}
                {quote && quote.totalTTC > 0 && ` · ${fmtUSD(quote.totalTTC)} TTC`}
              </span>
            )}
          </div>
        )}
        <button onClick={save} disabled={saving} className="abtn-primary">
          {saving ? "Enregistrement…" : "💾 Enregistrer"}
        </button>
      </div>

      {/* Status */}
      <Card title="Statut">
        <div className="flex flex-wrap gap-2">
          {[
            ...STATUS_BTNS,
            // keep a legacy status visible (and selected) until it is changed
            ...LEGACY_STATUS_BTNS.filter(([v]) => v === form.status),
          ].map(([value, label, cls]) => (
            <button
              key={value}
              onClick={() => set("status", value)}
              className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                form.status === value ? cls : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.status === "option" && (
          <div className="afield mt-4 max-w-56">
            <label>⏳ Option valable jusqu&apos;au</label>
            <input
              type="date"
              value={form.optionExpires}
              onChange={(e) => set("optionExpires", e.target.value)}
            />
          </div>
        )}
        {form.status === "confirmed" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm">
            {loaded?.confirmationEmailSent ? (
              <>
                <span className="font-medium text-emerald-700">
                  ✓ Email de confirmation envoyé au client
                </span>
                <button
                  type="button"
                  className="abtn-ghost !py-1 text-xs"
                  onClick={async () => {
                    const res = await doAction("send-confirmation");
                    if (res?.success) {
                      push(res.emailSent ? "Email de confirmation renvoyé" : "Email en file (SMTP non configuré)");
                      load();
                    }
                  }}
                >
                  Renvoyer
                </button>
              </>
            ) : (
              <>
                <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={sendConfirmation}
                    onChange={(e) => setSendConfirmation(e.target.checked)}
                    className="accent-navy"
                  />
                  ✉️ Envoyer l&apos;email de confirmation au client à l&apos;enregistrement
                </label>
                {reservationId && (
                  <button
                    type="button"
                    className="abtn-ghost !py-1 text-xs"
                    onClick={async () => {
                      const res = await doAction("send-confirmation");
                      if (res?.success) {
                        push(res.emailSent ? "Email de confirmation envoyé" : "Email en file (SMTP non configuré)");
                        load();
                      }
                    }}
                  >
                    Envoyer maintenant
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Dates */}
      <Card title="Dates">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="afield">
            <label>Arrivée</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="afield">
            <label>Départ</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.earlyCheckin}
              onChange={(e) => set("earlyCheckin", e.target.checked)}
              className="accent-navy"
            />
            Early check-in
            {form.earlyCheckin && (
              <input
                type="time"
                value={form.arrivalTime}
                onChange={(e) => set("arrivalTime", e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
            )}
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.lateCheckout}
              onChange={(e) => set("lateCheckout", e.target.checked)}
              className="accent-navy"
            />
            Late check-out
            {form.lateCheckout && (
              <input
                type="time"
                value={form.departureTime}
                onChange={(e) => set("departureTime", e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
            )}
          </label>
        </div>
      </Card>

      {/* Client */}
      <Card title="Client">
        {linkedClient && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy/20 bg-navy/5 px-4 py-2.5 text-sm">
            <div>
              <span className="font-semibold text-navy">
                {linkedClient.firstname} {linkedClient.lastname}
              </span>
              {linkedClient.isVip && " ⭐ VIP"}
              {linkedClient.blacklisted && (
                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                  ⛔ Liste noire
                </span>
              )}
              {linkedClient.discountPercent > 0 && (
                <span className="ml-2 text-xs text-emerald-700">
                  Remise client {linkedClient.discountPercent}%
                </span>
              )}
              {linkedClient.stats && (
                <span className="ml-2 text-xs text-slate-500">
                  {linkedClient.stats.stays} séjours · {fmtUSD(linkedClient.stats.spent)}
                </span>
              )}
            </div>
            <button onClick={unlinkClient} className="text-xs text-slate-400 hover:text-red-600">
              ✕ Délier
            </button>
          </div>
        )}
        {/* standing client discount not applied to this stay yet */}
        {linkedClient &&
          linkedClient.discountPercent > 0 &&
          form.discountPercent !== linkedClient.discountPercent && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
              <span className="text-emerald-800">
                🎁 Remise client habituelle de <strong>{linkedClient.discountPercent}%</strong>
                {linkedClient.discountReason ? ` — ${linkedClient.discountReason}` : ""}
              </span>
              <button
                type="button"
                className="abtn-primary !py-1 text-xs"
                onClick={() => set("discountPercent", linkedClient.discountPercent)}
              >
                Appliquer
              </button>
            </div>
          )}
        <div className="relative grid gap-4 sm:grid-cols-2">
          <div className="afield">
            <label>Prénom</label>
            <input
              value={form.clientFirst}
              onChange={(e) => {
                set("clientFirst", e.target.value);
                searchClients(e.target.value + " " + form.clientLast);
              }}
              placeholder="Ex : Jean"
              autoComplete="off"
            />
          </div>
          <div className="afield">
            <label>Nom</label>
            <input
              value={form.clientLast}
              onChange={(e) => {
                set("clientLast", e.target.value);
                searchClients(form.clientFirst + " " + e.target.value);
              }}
              placeholder="Ex : Martin"
              autoComplete="off"
            />
          </div>
          {showHits && hits.length > 0 && (
            <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {hits.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickClient(c)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    {c.firstname} {c.lastname} {c.isVip && "⭐"}
                    {c.blacklisted && " ⛔"}
                  </span>
                  <span className="text-xs text-slate-400">{c.email}</span>
                </button>
              ))}
              <button
                onClick={() => setShowHits(false)}
                className="w-full border-t border-slate-100 px-4 py-2 text-xs text-slate-400 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          )}
          <div className="afield">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="client@email.com"
            />
          </div>
          <div className="afield">
            <label>Téléphone</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="afield">
            <label>Chambres</label>
            <select
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", parseInt(e.target.value))}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} chambres
                </option>
              ))}
            </select>
          </div>
          <div className="afield">
            <label>Personnes</label>
            <select value={form.guests} onChange={(e) => set("guests", parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} pers.
                </option>
              ))}
            </select>
          </div>
          <div className="afield">
            <label>Agence partenaire</label>
            <select
              value={form.agencyId ?? ""}
              onChange={(e) => {
                if (e.target.value === "__new") {
                  setNewAgency("");
                  return;
                }
                const id = e.target.value ? parseInt(e.target.value) : null;
                const agency = agencyList.find((a) => a.id === id);
                setForm((f) => ({
                  ...f,
                  agencyId: id,
                  agencyFeePercent: agency?.commissionPercent ?? 0,
                }));
              }}
            >
              <option value="">Direct</option>
              {agencyList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.commissionPercent}%)
                </option>
              ))}
              <option value="__new">＋ Autre agence…</option>
            </select>
            {newAgency !== null && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={newAgency}
                  onChange={(e) => setNewAgency(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAgency()}
                  placeholder="Nom de l'agence"
                />
                <button type="button" className="abtn-primary !py-1 text-xs" onClick={createAgency}>
                  Créer
                </button>
                <button
                  type="button"
                  className="abtn-ghost !py-1 text-xs"
                  onClick={() => setNewAgency(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="afield mt-4">
          <label>Particularités client</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Ex : arrivée tardive, anniversaire…"
          />
        </div>
      </Card>

      {/* Variable periods */}
      <Card
        title={
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.useVariable}
              onChange={(e) => set("useVariable", e.target.checked)}
              className="accent-navy"
            />
            🔄 Chambres / tarifs variables par période
          </label>
        }
        action={
          form.useVariable && (
            <button onClick={addPeriod} className="abtn-ghost !px-2.5 !py-1 text-xs">
              + Période
            </button>
          )
        }
      >
        {!form.useVariable ? (
          <p className="text-xs text-slate-400">
            Pour les longs séjours dont le nombre de chambres ou le tarif hebdomadaire change en
            cours de séjour.
          </p>
        ) : form.periods.length === 0 ? (
          <p className="text-sm text-slate-400">
            Cliquez sur « + Période » pour découper le séjour.
          </p>
        ) : (
          <div className="space-y-2.5">
            {form.periods.map((p, i) => {
              const pNights =
                p.startDate && p.endDate && p.endDate > p.startDate
                  ? nightsBetween(p.startDate, p.endDate)
                  : 0;
              const line = quote?.lines[i];
              return (
                <div
                  key={i}
                  className="grid items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto]"
                >
                  <div className="afield">
                    <label>Du</label>
                    <input
                      type="date"
                      value={p.startDate}
                      onChange={(e) => setPeriod(i, { startDate: e.target.value })}
                    />
                  </div>
                  <div className="afield">
                    <label>Au</label>
                    <input
                      type="date"
                      value={p.endDate}
                      min={p.startDate}
                      onChange={(e) => setPeriod(i, { endDate: e.target.value })}
                    />
                  </div>
                  <div className="afield w-24">
                    <label>Chambres</label>
                    <select
                      value={p.bedrooms}
                      onChange={(e) => setPeriod(i, { bedrooms: parseInt(e.target.value) })}
                    >
                      {[2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n} ch
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="afield w-32">
                    <label>Tarif hebdo $</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      placeholder="saison"
                      value={p.weeklyRate ?? ""}
                      onChange={(e) =>
                        setPeriod(i, {
                          weeklyRate: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="pb-2 text-right text-sm">
                    <div className="text-xs text-slate-400">{pNights} nuits</div>
                    <div className="font-semibold text-slate-700">
                      {line ? fmtUSD(line.amount) : "—"}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        periods: f.periods.filter((_, j) => j !== i),
                      }))
                    }
                    className="mb-1 h-8 w-8 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer la période"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {coveredNights && coveredNights.uncovered > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠ {coveredNights.uncovered} nuit(s) hors périodes — facturées au tarif saison avec{" "}
                {form.bedrooms} chambres.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Pricing */}
      <Card title="💰 Tarification">
        {quote ? (
          <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
              <span>
                {quote.nights} nuits · {quote.seasonSummary}
              </span>
              {!quote.minStayOk && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Min. {quote.minStayRequired} nuits
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {quote.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-600">{l.labelFr}</span>
                  <span className="font-medium">{fmtUSD(l.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-5 text-sm text-slate-400">Choisissez les dates pour calculer le tarif.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="afield">
            <label>Tarif hebdo. spécial ($)</label>
            <input
              type="number"
              step="100"
              min="0"
              placeholder="vide = tarif saison"
              value={form.customWeeklyRate}
              disabled={form.useVariable}
              onChange={(e) => set("customWeeklyRate", e.target.value)}
            />
            <span className="text-[0.65rem] text-slate-400">Ex : tarif ami sur séjour mixte</span>
          </div>
          <div className="afield">
            <label>Tarif réel HT ($)</label>
            <input
              type="number"
              step="100"
              min="0"
              placeholder="vide = calculé"
              value={form.finalPriceOverride}
              onChange={(e) => set("finalPriceOverride", e.target.value)}
            />
            <span className="text-[0.65rem] text-slate-400">Si différent du tarif calculé</span>
          </div>
          <div className="afield">
            <label>Remise (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.discountPercent || ""}
              placeholder="0"
              onChange={(e) => set("discountPercent", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="afield">
            <label>Commission agence (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.agencyFeePercent || ""}
              placeholder="0"
              onChange={(e) => set("agencyFeePercent", parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Special offers */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-amber-50 px-4 py-3 text-sm">
          <label className="flex items-center gap-2" title="4ch→3ch, 3ch→2ch">
            <input
              type="checkbox"
              checked={form.offerOneRoom}
              disabled={form.useVariable || form.bedrooms < 3}
              onChange={(e) => set("offerOneRoom", e.target.checked)}
              className="accent-gold"
            />
            🏷️ Offrir 1 chambre
          </label>
          <label className="flex items-center gap-2">
            🎁 Nuits offertes :
            <input
              type="number"
              min="0"
              max="7"
              value={form.freeNights}
              onChange={(e) => set("freeNights", parseInt(e.target.value) || 0)}
              className="w-16 rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.noTax}
              onChange={(e) => set("noTax", e.target.checked)}
              className="accent-gold"
            />
            🎁 Offrir la taxe de séjour
          </label>
        </div>

        {/* Revenue preview */}
        {quote && (
          <div className="mt-5 space-y-1.5 rounded-xl bg-gradient-to-br from-navy to-navy-deep p-5 text-sm text-white">
            <Row label="Prix de base HT" value={fmtUSD(quote.baseBeforeOffers)} />
            {quote.offerOneRoomDiscount > 0 && (
              <Row label="🏷️ 1 chambre offerte" value={`-${fmtUSD(quote.offerOneRoomDiscount)}`} accent="text-amber-300" />
            )}
            {quote.freeNightsDiscount > 0 && (
              <Row
                label={`🎁 Nuits offertes (${form.freeNights})`}
                value={`-${fmtUSD(quote.freeNightsDiscount)}`}
                accent="text-amber-300"
              />
            )}
            {quote.discountAmount > 0 && (
              <Row
                label={`Remise (${form.discountPercent}%)`}
                value={`-${fmtUSD(quote.discountAmount)}`}
                accent="text-amber-300"
              />
            )}
            <div className="!my-2.5 border-t border-white/20" />
            <Row
              label={quote.overridden ? "Tarif réel HT (manuel)" : "Sous-total HT"}
              value={fmtUSD(quote.finalHT)}
              bold
            />
            {quote.agencyFeeAmount > 0 && (
              <Row
                label={`Commission agence (${form.agencyFeePercent}%)`}
                value={`-${fmtUSD(quote.agencyFeeAmount)}`}
                accent="text-red-300"
              />
            )}
            <Row label="Revenu net (HT − commission)" value={fmtUSD(quote.netRevenue)} bold accent="text-emerald-300" />
            {!form.noTax && (
              <Row label="Taxe de séjour (5%)" value={`+${fmtUSD(quote.taxAmount)}`} accent="text-white/70" />
            )}
            <div className="!my-2.5 border-t border-gold/50" />
            <Row label="Total TTC (à encaisser)" value={fmtUSD(quote.totalTTC)} bold accent="text-gold" big />
          </div>
        )}

        {/* Profitability */}
        {profitability && (
          <div className="mt-4">
            <button
              onClick={() => setShowProfit((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              📊 Analyse de rentabilité
              <span>{showProfit ? "▲" : "▼"}</span>
            </button>
            {showProfit && (
              <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <Row2 label="Revenu net (USD)" value={fmtUSD(profitability.netUSD)} pos />
                <Row2 label="Revenu net (EUR)" value={fmtEUR(profitability.netEUR)} />
                <div className="!my-2 border-t border-slate-100" />
                <Row2
                  label={`Ménage (${costs.cleaningPerDayEUR}€/j)`}
                  value={`-${fmtEUR(profitability.cleaning)}`}
                  neg
                />
                <Row2
                  label="Charges fixes (proratisées)"
                  value={`-${fmtEUR(profitability.fixed)}`}
                  neg
                />
                <Row2
                  label="Coût journalier"
                  value={`${fmtEUR(profitability.costPerNight)}/nuit`}
                />
                <div className="!my-2 border-t border-slate-100" />
                <Row2
                  label="Marge nette"
                  value={`${fmtEUR(profitability.margin)} (${Math.round(profitability.marginPercent)}%)`}
                  pos={profitability.margin >= 0}
                  neg={profitability.margin < 0}
                  bold
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Payments */}
      <Card
        title="💳 Paiement"
        action={
          reservationId && (
            <button onClick={() => setPayModal(true)} className="abtn-ghost !px-2.5 !py-1 text-xs">
              + Paiement
            </button>
          )
        }
      >
        <label className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <input
            type="checkbox"
            checked={form.balanceReceived}
            onChange={(e) => set("balanceReceived", e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          ✔ Paiement complet reçu
          {loyaltyEnabled && form.balanceReceived && form.clientId && (
            <span className="ml-auto text-xs font-normal">
              ✦ points fidélité attribués à l&apos;enregistrement
            </span>
          )}
        </label>

        <div className="mt-4 grid items-end gap-4 sm:grid-cols-3">
          <div className="afield">
            <label>Acompte attendu ($)</label>
            <input
              type="number"
              step="50"
              min="0"
              value={form.depositAmount}
              onChange={(e) => {
                depositTouched.current = true;
                set("depositAmount", e.target.value);
              }}
            />
            <span className="text-[0.65rem] text-emerald-600">
              Auto : 30% du TTC {quote ? `(${fmtUSD(quote.depositAmount)})` : ""}
            </span>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.depositReceived}
              onChange={(e) => set("depositReceived", e.target.checked)}
              className="accent-navy"
            />
            Acompte reçu
          </label>
          <div className="pb-1 text-sm">
            <div className="text-xs text-slate-400">Balance restante</div>
            <div className="font-display text-2xl text-navy">
              {quote ? fmtUSD(Math.max(0, quote.totalTTC - totalPaid)) : "—"}
            </div>
          </div>
        </div>

        {loaded && loaded.payments.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Méthode</th>
                  <th className="px-3 py-2 text-right font-medium">Montant</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loaded.payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{fmtDate(p.receivedAt)}</td>
                    <td className="px-3 py-2">
                      {{ deposit: "Acompte", balance: "Solde", extra: "Extra", refund: "Remboursement" }[p.kind] ?? p.kind}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{p.method}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${p.kind === "refund" ? "text-red-600" : ""}`}>
                      {p.kind === "refund" ? "-" : ""}
                      {fmtUSD(p.amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ConfirmButton
                        className="text-xs text-slate-300 hover:text-red-600"
                        confirmLabel="Supprimer ?"
                        onConfirm={async () => {
                          await doAction("delete-payment", { paymentId: p.id });
                          load();
                        }}
                      >
                        ✕
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Total encaissé
                  </td>
                  <td className="px-3 py-2 text-right">{fmtUSD(totalPaid)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Documents & actions */}
      {reservationId && (
        <Card title="📄 Contrat & espace client">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => generateContract("en", false)} className="abtn-ghost">
              Contrat EN — lien
            </button>
            <button onClick={() => generateContract("fr", false)} className="abtn-ghost">
              Contrat FR — lien
            </button>
            <button
              onClick={async () => {
                // language defaults to the linked client's language server-side
                const res = await doAction("send-contract", {});
                if (res?.success) {
                  push(
                    res.emailSent
                      ? "Contrat envoyé par email"
                      : "Contrat généré (email en file — SMTP non configuré)"
                  );
                  load();
                }
              }}
              className="abtn-primary"
            >
              ✍️ Envoyer pour signature
            </button>
            <span className="mx-2 hidden h-6 w-px bg-slate-200 sm:block" />
            <button onClick={() => portalLink(false)} className="abtn-ghost">
              🔗 Lien espace client
            </button>
            <button onClick={() => portalLink(true)} className="abtn-ghost">
              ✉️ Envoyer l&apos;accès client
            </button>
          </div>
          {latestContract && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span>
                Contrat {latestContract.language.toUpperCase()} ·{" "}
                {latestContract.status === "signed" ? (
                  <span className="font-semibold text-emerald-600">
                    ✓ signé le {latestContract.signedAt ? fmtDate(latestContract.signedAt) : ""}
                  </span>
                ) : (
                  <span className="font-medium text-amber-600">
                    en attente de signature · vu {latestContract.viewCount}×
                  </span>
                )}
              </span>
              <a
                href={`/api/contracts/pdf/${latestContract.token}`}
                target="_blank"
                className="text-navy underline"
              >
                PDF
              </a>
              <a
                href={`/contracts/sign/${latestContract.token}`}
                target="_blank"
                className="text-navy underline"
              >
                Page de signature
              </a>
            </div>
          )}
        </Card>
      )}

      {/* Danger zone */}
      {reservationId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await doAction(loaded?.isArchived ? "unarchive" : "archive");
                push(loaded?.isArchived ? "Désarchivée" : "Archivée");
                load();
              }}
              className="abtn-ghost"
            >
              {loaded?.isArchived ? "📤 Désarchiver" : "🗄️ Archiver"}
            </button>
          </div>
          <ConfirmButton onConfirm={remove} confirmLabel="Vraiment supprimer ?">
            🗑 Supprimer la réservation
          </ConfirmButton>
        </div>
      )}

      {/* Sticky save on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={save} disabled={saving} className="abtn-primary w-full">
          {saving ? "Enregistrement…" : "💾 Enregistrer"}
        </button>
      </div>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Enregistrer un paiement">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="afield">
              <label>Type</label>
              <select
                value={payForm.kind}
                onChange={(e) => setPayForm({ ...payForm, kind: e.target.value })}
              >
                <option value="deposit">Acompte</option>
                <option value="balance">Solde</option>
                <option value="extra">Extra</option>
                <option value="refund">Remboursement</option>
              </select>
            </div>
            <div className="afield">
              <label>Méthode</label>
              <select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              >
                <option value="wire">Virement</option>
                <option value="card">Carte</option>
                <option value="cash">Espèces</option>
                <option value="check">Chèque</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div className="afield">
              <label>Montant ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </div>
            <div className="afield">
              <label>Date de réception</label>
              <input
                type="date"
                value={payForm.receivedAt}
                onChange={(e) => setPayForm({ ...payForm, receivedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="afield">
            <label>Note</label>
            <input
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              placeholder="Référence virement…"
            />
          </div>
          <button onClick={addPayment} className="abtn-primary w-full">
            Enregistrer le paiement
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  big,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={accent ?? "text-white/85"}>{label}</span>
      <span className={`${accent ?? ""} ${big ? "font-display text-2xl" : ""}`}>{value}</span>
    </div>
  );
}

function Row2({
  label,
  value,
  pos,
  neg,
  bold,
}: {
  label: string;
  value: string;
  pos?: boolean;
  neg?: boolean;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-slate-500">{label}</span>
      <span className={pos ? "text-emerald-600" : neg ? "text-red-600" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
}
