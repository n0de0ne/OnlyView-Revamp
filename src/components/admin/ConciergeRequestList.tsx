"use client";

import Link from "next/link";
import { useState } from "react";
import type { SerializedReservationExtra } from "@/lib/extras";
import { api, fmtDate, Modal, useToast } from "./ui";
import { BADGES_EVENT } from "./AdminShell";

export type ConciergeRequest = SerializedReservationExtra & {
  placePhone?: string | null;
  placeBookingUrl?: string | null;
  reservation?: {
    id: number;
    clientName: string | null;
    startDate: string;
    endDate: string;
    status: string;
    agency: string | null;
  };
};

export const CONCIERGE_STATUS: Record<string, { label: string; className: string }> = {
  requested: { label: "À traiter", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmé", className: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Refusé", className: "bg-slate-200 text-slate-600" },
  cancelled: { label: "Annulé", className: "bg-slate-100 text-slate-500 line-through" },
};

const ICON: Record<string, string> = { restaurant: "🍽️", boat: "⛵", chef: "👨‍🍳" };

/** "sam. 2 oct." */
const day = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "date ?";

/**
 * Concierge requests (tables, boats, private chef) with their date, time and
 * party size, and the owner's answer: confirm or decline, an optional note
 * for the guest, and an email to the guest. Used by the "Demandes
 * conciergerie" inbox and by the reservation editor.
 */
export function ConciergeRequestList({
  items,
  onChange,
  showStay = false,
  reservationId,
}: {
  items: ConciergeRequest[];
  onChange: (item: ConciergeRequest) => void;
  /** the inbox lists several stays: show whose request it is */
  showStay?: boolean;
  /** the stay, when the items don't carry it (reservation editor) */
  reservationId?: number;
}) {
  const { push } = useToast();
  const [editing, setEditing] = useState<ConciergeRequest | null>(null);
  const [form, setForm] = useState({ status: "confirmed", serviceDate: "", serviceTime: "", guests: "", adminNote: "", notify: true });
  const [busy, setBusy] = useState(false);

  const open = (i: ConciergeRequest, status: string) => {
    setEditing(i);
    setForm({
      status,
      serviceDate: i.serviceDate ?? "",
      serviceTime: i.serviceTime ?? "",
      guests: i.guests != null ? String(i.guests) : "",
      adminNote: i.adminNote ?? "",
      notify: true,
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const res = await api<{ item: ConciergeRequest; guestEmailed: boolean }>(
      `/api/admin/reservations/${editing.reservation?.id ?? reservationId}/extras/${editing.id}`,
      {
        method: "PUT",
        json: {
          status: form.status,
          serviceDate: form.serviceDate || null,
          serviceTime: form.serviceTime || null,
          guests: form.guests ? Math.max(1, parseInt(form.guests, 10) || 1) : null,
          adminNote: form.adminNote.trim() || null,
          notifyGuest: form.notify,
        },
      }
    );
    setBusy(false);
    if (!res.success) return push(`Erreur : ${res.error}`, "error");
    onChange({ ...editing, ...res.item });
    setEditing(null);
    window.dispatchEvent(new Event(BADGES_EVENT));
    push(res.guestEmailed ? "Réponse enregistrée — client prévenu par email" : "Réponse enregistrée");
  };

  if (items.length === 0) return null;

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {items.map((i) => {
          const st = CONCIERGE_STATUS[i.status] ?? CONCIERGE_STATUS.requested;
          return (
            <li key={i.id} className={`py-3 ${i.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden>{ICON[i.category ?? ""] ?? "🛎️"}</span>
                    <span className="font-semibold text-slate-800">{i.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase ${st.className}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {day(i.serviceDate)}
                    {i.serviceTime && <> · {i.serviceTime}</>}
                    {i.guests != null && <> · {i.guests} pers.</>}
                  </div>
                  {showStay && i.reservation && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      <Link href={`/admin/reservations/${i.reservation.id}`} className="font-medium text-navy hover:underline">
                        {i.reservation.clientName ?? `Réservation #${i.reservation.id}`}
                      </Link>{" "}
                      · séjour {fmtDate(i.reservation.startDate)} → {fmtDate(i.reservation.endDate)}
                      {i.reservation.agency && (
                        <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-violet-700">
                          {i.reservation.agency}
                        </span>
                      )}
                    </div>
                  )}
                  {i.notes && <div className="mt-1 whitespace-pre-line text-xs text-slate-500">{i.notes}</div>}
                  {(i.placePhone || i.placeBookingUrl) && (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {i.placePhone && (
                        <a href={`tel:${i.placePhone.replace(/\s/g, "")}`} className="text-navy underline">
                          ☎ {i.placePhone}
                        </a>
                      )}
                      {i.placeBookingUrl && (
                        <a href={i.placeBookingUrl} target="_blank" rel="noopener" className="text-navy underline">
                          Réserver en ligne ↗
                        </a>
                      )}
                    </div>
                  )}
                  {i.adminNote && (
                    <div className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                      Réponse au client : {i.adminNote}
                    </div>
                  )}
                  <div className="mt-1 text-[0.65rem] text-slate-400">
                    demandé le {fmtDate(i.createdAt.slice(0, 10))}
                    {i.answeredAt && ` · répondu le ${fmtDate(i.answeredAt.slice(0, 10))}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {i.status === "requested" ? (
                    <>
                      <button onClick={() => open(i, "confirmed")} className="abtn-primary !px-3 !py-1.5 text-xs">
                        ✓ Confirmer
                      </button>
                      <button onClick={() => open(i, "declined")} className="abtn-ghost !px-3 !py-1.5 text-xs">
                        Refuser
                      </button>
                    </>
                  ) : (
                    <button onClick={() => open(i, i.status)} className="abtn-ghost !px-3 !py-1.5 text-xs">
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={editing != null} onClose={() => setEditing(null)} title={editing?.label ?? ""}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(CONCIERGE_STATUS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, status: k })}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                  form.status === k ? "border-navy bg-navy/5 text-navy" : "border-slate-200 text-slate-400"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="afield">
              <label>Date</label>
              <input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
            </div>
            <div className="afield">
              <label>Heure</label>
              <input type="time" step={900} value={form.serviceTime} onChange={(e) => setForm({ ...form, serviceTime: e.target.value })} />
            </div>
            <div className="afield">
              <label>Personnes</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.guests}
                onChange={(e) => setForm({ ...form, guests: e.target.value })}
              />
            </div>
          </div>
          <div className="afield">
            <label>Message au client (optionnel, visible dans son espace)</label>
            <textarea
              rows={3}
              value={form.adminNote}
              placeholder={
                form.status === "declined"
                  ? "Ex : complet ce soir-là — je peux vous proposer 21h30 ou le Bonito."
                  : "Ex : table réservée au nom de Strok, en terrasse."
              }
              onChange={(e) => setForm({ ...form, adminNote: e.target.value })}
            />
          </div>
          {form.status !== "requested" && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
              Prévenir le client par email
            </label>
          )}
          <button onClick={save} disabled={busy} className="abtn-primary w-full">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </Modal>
    </>
  );
}
