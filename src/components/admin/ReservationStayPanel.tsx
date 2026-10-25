"use client";

import { useEffect, useState } from "react";
import type { SerializedReservation } from "@/lib/reservations";
import type { SerializedReservationExtra } from "@/lib/extras";
import { api, Card, ConfirmButton, fmtDate, fmtUSD, Modal, StatusBadge, useToast } from "./ui";
import { UNIT_LABELS, type CatalogExtra } from "./ExtrasBoard";
import { ConciergeRequestList } from "./ConciergeRequestList";

type Details = SerializedReservation["guestDetails"];

const EXTRA_STATUS: Record<string, string> = {
  requested: "Demandé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
};

const str = (v: string | null) => v ?? "";
const intOrNull = (v: string) => (v.trim() === "" ? null : parseInt(v, 10));

/**
 * Arrival details, concierge requests and extras of a saved stay. Each part saves on its own (not
 * with the main form), so what the guest typed in the portal is never
 * overwritten by a stale editor.
 */
export function ReservationStayPanel({
  reservationId,
  details,
  extras: initialExtras,
  nights,
  guests,
  onExtrasTotal,
}: {
  reservationId: number;
  details: Details;
  extras: SerializedReservationExtra[];
  nights: number;
  guests: number;
  onExtrasTotal: (confirmedTotal: number) => void;
}) {
  const { push } = useToast();
  const [d, setD] = useState({
    arrivalFlight: str(details.arrivalFlight),
    arrivalEta: str(details.arrivalEta),
    departureFlight: str(details.departureFlight),
    departureEta: str(details.departureEta),
    adults: details.adults != null ? String(details.adults) : "",
    children: details.children != null ? String(details.children) : "",
    guestNames: str(details.guestNames),
    specialRequests: str(details.specialRequests),
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [items, setItems] = useState(initialExtras);
  const [catalog, setCatalog] = useState<CatalogExtra[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [line, setLine] = useState({
    extraId: null as number | null,
    label: "",
    quantity: "1",
    unitPrice: "",
    serviceDate: "",
    notes: "",
  });

  useEffect(() => {
    api<{ extras: CatalogExtra[] }>("/api/admin/extras").then(
      (r) => r.success && setCatalog(r.extras.filter((x) => x.isActive))
    );
  }, []);

  useEffect(() => {
    onExtrasTotal(items.filter((i) => i.status === "confirmed").reduce((s, i) => s + i.amount, 0));
  }, [items, onExtrasTotal]);

  const saveDetails = async () => {
    setSavingDetails(true);
    const res = await api(`/api/admin/reservations/${reservationId}/guest-details`, {
      method: "PUT",
      json: {
        ...d,
        adults: intOrNull(d.adults),
        children: intOrNull(d.children),
      },
    });
    setSavingDetails(false);
    if (res.success) push("Infos d'arrivée enregistrées");
    else push(`Erreur : ${res.error}`, "error");
  };

  const pickCatalog = (id: string) => {
    const x = catalog.find((c) => c.id === parseInt(id, 10));
    if (!x) {
      setLine({ ...line, extraId: null });
      return;
    }
    const qty = x.unit === "night" ? nights : x.unit === "person" ? guests : 1;
    setLine({
      ...line,
      extraId: x.id,
      label: x.nameFr,
      quantity: String(Math.max(1, qty)),
      unitPrice: String(x.price),
    });
  };

  const addLine = async () => {
    const res = await api<{ item: SerializedReservationExtra }>(
      `/api/admin/reservations/${reservationId}/extras`,
      {
        method: "POST",
        json: {
          extraId: line.extraId,
          label: line.label,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unitPrice) || 0,
          status: "confirmed",
          serviceDate: line.serviceDate || null,
          notes: line.notes || null,
        },
      }
    );
    if (res.success) {
      setItems([...items, res.item]);
      setAddOpen(false);
      setLine({ extraId: null, label: "", quantity: "1", unitPrice: "", serviceDate: "", notes: "" });
      push("Extra ajouté");
    } else push(`Erreur : ${res.error}`, "error");
  };

  const updateItem = async (id: number, patch: Record<string, unknown>) => {
    const res = await api<{ item: SerializedReservationExtra }>(
      `/api/admin/reservations/${reservationId}/extras/${id}`,
      { method: "PUT", json: patch }
    );
    if (res.success) setItems(items.map((i) => (i.id === id ? res.item : i)));
    else push(`Erreur : ${res.error}`, "error");
  };

  const removeItem = async (id: number) => {
    const res = await api(`/api/admin/reservations/${reservationId}/extras/${id}`, { method: "DELETE" });
    if (res.success) setItems(items.filter((i) => i.id !== id));
  };

  const extras = items.filter((i) => i.kind !== "concierge");
  const concierge = items.filter((i) => i.kind === "concierge");
  const confirmedTotal = extras.filter((i) => i.status === "confirmed").reduce((s, i) => s + i.amount, 0);
  const field = (k: keyof typeof d, label: string, placeholder?: string) => (
    <div className="afield">
      <label>{label}</label>
      <input value={d[k]} placeholder={placeholder} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
    </div>
  );

  return (
    <>
      <Card
        title="🧳 Arrivée & invités"
        action={
          details.updatedAt && (
            <span className="text-[0.65rem] text-slate-400">mis à jour le {fmtDate(details.updatedAt)}</span>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          {field("arrivalFlight", "Vol d'arrivée", "Ex : PV 2211 depuis SXM")}
          {field("arrivalEta", "Heure d'arrivée prévue", "15:30")}
          {field("departureFlight", "Vol de départ")}
          {field("departureEta", "Heure de départ prévue")}
          {field("adults", "Adultes")}
          {field("children", "Enfants")}
          <div className="afield sm:col-span-2">
            <label>Invités (un par ligne)</label>
            <textarea rows={3} value={d.guestNames} onChange={(e) => setD({ ...d, guestNames: e.target.value })} />
          </div>
          <div className="afield sm:col-span-4">
            <label>Demandes particulières (allergies, anniversaire, lit bébé…)</label>
            <textarea
              rows={2}
              value={d.specialRequests}
              onChange={(e) => setD({ ...d, specialRequests: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[0.7rem] text-slate-400">
            Le client peut aussi remplir ces infos depuis son espace client.
          </span>
          <button onClick={saveDetails} disabled={savingDetails} className="abtn-ghost">
            {savingDetails ? "Enregistrement…" : "Enregistrer les infos"}
          </button>
        </div>
      </Card>

      {concierge.length > 0 && (
        <Card
          title="🛎️ Conciergerie"
          action={
            concierge.some((i) => i.status === "requested") && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-blue-700">
                {concierge.filter((i) => i.status === "requested").length} à traiter
              </span>
            )
          }
        >
          <ConciergeRequestList
            items={concierge}
            reservationId={reservationId}
            onChange={(next) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)))}
          />
        </Card>
      )}

      <Card
        title="🍾 Extras"
        action={
          <button onClick={() => setAddOpen(true)} className="abtn-ghost !px-2.5 !py-1 text-xs">
            + Extra
          </button>
        }
      >
        {extras.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun extra sur ce séjour.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Extra</th>
                  <th className="px-3 py-2 text-right font-medium">Qté × prix</th>
                  <th className="px-3 py-2 text-right font-medium">Montant</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {extras.map((i) => (
                  <tr key={i.id} className={`border-t border-slate-100 ${i.status === "cancelled" ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">
                        {i.label}
                        {i.requestedByGuest && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-blue-700">
                            DEMANDE CLIENT
                          </span>
                        )}
                      </div>
                      {(i.serviceDate || i.notes) && (
                        <div className="text-xs text-slate-400">
                          {i.serviceDate && fmtDate(i.serviceDate)}
                          {i.serviceDate && i.notes && " · "}
                          {i.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {i.quantity} × {fmtUSD(i.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtUSD(i.amount)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={i.status}
                        onChange={(e) => updateItem(i.id, { status: e.target.value })}
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        aria-label="Statut"
                      >
                        {Object.entries(EXTRA_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ConfirmButton
                        className="text-xs text-slate-300 hover:text-red-600"
                        confirmLabel="Supprimer ?"
                        onConfirm={() => removeItem(i.id)}
                      >
                        ✕
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Total extras confirmés
                  </td>
                  <td className="px-3 py-2 text-right">{fmtUSD(confirmedTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {extras.some((i) => i.status === "requested") && (
          <p className="mt-3 flex items-center gap-2 text-xs text-blue-700">
            <StatusBadge status="new" /> Demandes à traiter : passez-les en « Confirmé » (comptées dans le solde)
            ou « Annulé ».
          </p>
        )}
        <p className="mt-2 text-[0.7rem] text-slate-400">
          Les extras confirmés s&apos;ajoutent au solde à encaisser ; enregistrez leur règlement en paiement
          « Extra ».
        </p>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un extra">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="afield sm:col-span-2">
            <label>Depuis le catalogue</label>
            <select value={line.extraId ?? ""} onChange={(e) => pickCatalog(e.target.value)}>
              <option value="">— ligne libre —</option>
              {catalog.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nameFr} · {x.price > 0 ? fmtUSD(x.price) : "sur devis"} {UNIT_LABELS[x.unit] ?? ""}
                </option>
              ))}
            </select>
          </div>
          <div className="afield sm:col-span-2">
            <label>Libellé *</label>
            <input value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} />
          </div>
          <div className="afield">
            <label>Quantité</label>
            <input
              type="number"
              min="0"
              step="1"
              value={line.quantity}
              onChange={(e) => setLine({ ...line, quantity: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Prix unitaire ($)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={line.unitPrice}
              onChange={(e) => setLine({ ...line, unitPrice: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Date du service</label>
            <input
              type="date"
              value={line.serviceDate}
              onChange={(e) => setLine({ ...line, serviceDate: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Notes</label>
            <input value={line.notes} onChange={(e) => setLine({ ...line, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            = {fmtUSD((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0))}
          </span>
          <button onClick={addLine} disabled={!line.label.trim()} className="abtn-primary">
            Ajouter
          </button>
        </div>
      </Modal>
    </>
  );
}
