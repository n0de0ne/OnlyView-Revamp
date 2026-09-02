"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, Card, fmtDate, fmtUSD, Modal, Spinner, StatusBadge, useToast } from "./ui";

interface BookingRequest {
  id: number;
  startDate: string;
  endDate: string;
  bedrooms: number;
  guests: number;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  language: string;
  promoCode: string | null;
  status: string;
  adminNotes: string | null;
  reservationId: number | null;
  createdAt: string;
  quote: { totalTTC?: number; subtotalHT?: number } | null;
}

export function RequestsInbox() {
  const router = useRouter();
  const { push } = useToast();
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [convert, setConvert] = useState<BookingRequest | null>(null);
  const [convertStatus, setConvertStatus] = useState<"option" | "confirmed">("option");
  const [optionExpires, setOptionExpires] = useState("");

  const load = useCallback(() => {
    const p = filter === "all" ? "" : `?status=${filter}`;
    api<{ requests: BookingRequest[] }>(`/api/admin/requests${p}`).then(
      (d) => d.success && setRequests(d.requests)
    );
  }, [filter]);

  useEffect(load, [load]);

  const setStatus = async (id: number, status: string) => {
    const res = await api(`/api/admin/requests/${id}`, {
      method: "PUT",
      json: { action: "set-status", status },
    });
    if (res.success) {
      push("Statut mis à jour");
      load();
    }
  };

  const doConvert = async () => {
    if (!convert) return;
    const res = await api<{ reservationId: number }>(`/api/admin/requests/${convert.id}`, {
      method: "PUT",
      json: {
        action: "convert",
        reservationStatus: convertStatus,
        optionExpires: convertStatus === "option" && optionExpires ? optionExpires : null,
      },
    });
    if (res.success) {
      push("Réservation créée");
      router.push(`/admin/reservations/${res.reservationId}`);
    } else {
      push(
        res.error === "dates_conflict" ? "Conflit de dates au calendrier" : `Erreur : ${res.error}`,
        "error"
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Demandes de réservation</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Toutes</option>
          <option value="new">Nouvelles</option>
          <option value="answered">Répondues</option>
          <option value="converted">Converties</option>
          <option value="declined">Refusées</option>
        </select>
      </div>

      {!requests ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">Aucune demande</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-slate-800">{r.name}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-xs uppercase text-slate-400">{r.language}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.bedrooms} ch. ·{" "}
                    {r.guests} pers.
                    {r.quote?.totalTTC ? (
                      <span className="ml-2 font-medium text-slate-700">
                        Devis {fmtUSD(r.quote.totalTTC)} TTC
                      </span>
                    ) : null}
                    {r.promoCode && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-700">
                        Code {r.promoCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    <a href={`mailto:${r.email}`} className="inline-block py-2.5 hover:text-navy">
                      {r.email}
                    </a>
                    {r.phone && ` · ${r.phone}`} · reçue le {fmtDate(r.createdAt.slice(0, 10))}
                  </div>
                  {r.message && (
                    <p className="mt-2.5 max-w-xl rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                      {r.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.reservationId ? (
                    <Link href={`/admin/reservations/${r.reservationId}`} className="abtn-ghost">
                      Voir la réservation #{r.reservationId}
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setConvert(r);
                          setConvertStatus("option");
                        }}
                        className="abtn-primary"
                      >
                        → Convertir
                      </button>
                      {r.status !== "answered" && (
                        <button onClick={() => setStatus(r.id, "answered")} className="abtn-ghost">
                          Marquer répondu
                        </button>
                      )}
                      {r.status !== "declined" && (
                        <button onClick={() => setStatus(r.id, "declined")} className="abtn-ghost">
                          Refuser
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={convert != null}
        onClose={() => setConvert(null)}
        title={`Convertir la demande de ${convert?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {convert && (
              <>
                {fmtDate(convert.startDate)} → {fmtDate(convert.endDate)} · {convert.bedrooms} ch.
                · {convert.guests} pers. — le client sera créé/lié automatiquement.
              </>
            )}
          </p>
          <div className="flex gap-2">
            {(["option", "confirmed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setConvertStatus(s)}
                className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold ${
                  convertStatus === s
                    ? s === "option"
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-400"
                }`}
              >
                {s === "option" ? "🟠 En option" : "🔴 Confirmée"}
              </button>
            ))}
          </div>
          {convertStatus === "option" && (
            <div className="afield">
              <label>Option valable jusqu&apos;au (optionnel)</label>
              <input
                type="date"
                value={optionExpires}
                onChange={(e) => setOptionExpires(e.target.value)}
              />
            </div>
          )}
          <button onClick={doConvert} className="abtn-primary w-full">
            Créer la réservation
          </button>
        </div>
      </Modal>
    </div>
  );
}
