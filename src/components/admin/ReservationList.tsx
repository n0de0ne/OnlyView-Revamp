"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  Card,
  fmtDate,
  fmtUSD,
  seasonLabel,
  seasonOfDate,
  Spinner,
  StatusBadge,
  STATUS_LABELS,
} from "./ui";
import type { SerializedReservation } from "@/lib/reservations";

export function ReservationList() {
  const [reservations, setReservations] = useState<SerializedReservation[] | null>(null);
  const [season, setSeason] = useState<string>(() => String(seasonOfDate(new Date())));
  const [status, setStatus] = useState<string>("all");
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (season !== "all") params.set("season", season);
    if (status !== "all") params.set("status", status);
    params.set("archived", archived ? "1" : "0");
    api<{ reservations: SerializedReservation[] }>(
      `/api/admin/reservations?${params}`
    ).then((d) => d.success && setReservations(d.reservations));
  }, [season, status, archived]);

  const filtered = useMemo(() => {
    if (!reservations) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return reservations;
    return reservations.filter(
      (r) =>
        r.clientName?.toLowerCase().includes(needle) ||
        r.email?.toLowerCase().includes(needle) ||
        String(r.id) === needle
    );
  }, [reservations, q]);

  const seasons = useMemo(() => {
    const s = seasonOfDate(new Date());
    return [s + 1, s, s - 1, s - 2, s - 3, s - 4];
  }, []);

  const paymentDot = (r: SerializedReservation) =>
    r.balanceReceived ? (
      <span title="Payé en totalité" className="text-emerald-600">
        ●
      </span>
    ) : r.depositReceived ? (
      <span title="Acompte reçu" className="text-amber-500">
        ◐
      </span>
    ) : (
      <span title="Aucun paiement" className="text-slate-300">
        ○
      </span>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Réservations</h1>
        <Link href="/admin/reservations/new" className="abtn-gold">
          + Nouvelle réservation
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Rechercher client, email, n°…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          title="Une saison va du 1ᵉʳ septembre au 31 août"
        >
          <option value="all">Toutes saisons</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              Saison {seasonLabel(s)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tous statuts</option>
          {Object.entries(STATUS_LABELS)
            // the business only uses Option / Confirmé
            .filter(([k]) => k === "option" || k === "confirmed")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
            className="accent-navy"
          />
          Archivées
        </label>
      </div>

      <Card>
        {!filtered ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune réservation</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Client</th>
                  <th className="pb-2.5 pr-3 font-medium">Dates</th>
                  <th className="pb-2.5 pr-3 font-medium">Nuits</th>
                  <th className="pb-2.5 pr-3 font-medium">Ch.</th>
                  <th className="pb-2.5 pr-3 font-medium">Agence</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Total TTC</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">💳</th>
                  <th className="pb-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const nights = Math.round(
                    (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000
                  );
                  return (
                    <tr
                      key={r.id}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/reservations/${r.id}`}
                          className="block font-semibold text-slate-800 group-hover:text-navy"
                        >
                          {r.clientName ?? "Sans nom"}
                          {r.client?.isVip && <span title="VIP"> ⭐</span>}
                        </Link>
                        <span className="text-xs text-slate-400">#{r.id}</span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                        {r.status === "option" && r.optionExpires && (
                          <div className="text-xs text-amber-600">
                            ⏳ expire {fmtDate(r.optionExpires)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{nights}</td>
                      <td className="py-3 pr-3 text-slate-600">
                        {r.periods.length > 0 ? (
                          <span title="Chambres variables">🔄</span>
                        ) : (
                          r.bedrooms
                        )}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{r.agency?.name ?? "Direct"}</td>
                      <td className="py-3 pr-3 text-right font-semibold text-slate-800">
                        {fmtUSD(r.priceTTC)}
                      </td>
                      <td className="py-3 pr-3 text-center text-lg leading-none">
                        {paymentDot(r)}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
