"use client";

import { useState } from "react";
import type { SerializedDateChange } from "@/lib/date-changes";
import { api, Card, fmtDate, fmtUSD, useToast } from "./ui";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Acceptée", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusée", cls: "bg-slate-200 text-slate-600" },
  cancelled: { label: "Retirée", cls: "bg-slate-100 text-slate-500" },
};

const ERRORS: Record<string, string> = {
  has_periods:
    "Ce séjour a des périodes variables : modifiez les dates dans l'éditeur puis générez l'avenant.",
  stay_changed: "Les dates du séjour ont changé depuis la demande — refusez-la ou modifiez à la main.",
  dates_unavailable: "Les nouvelles dates ne sont plus libres.",
  already_decided: "Cette demande a déjà reçu une réponse.",
};

/**
 * Reservation editor — the guest's change-of-dates requests (approve /
 * reject) and the history of date changes on the stay.
 */
export function ReservationDateChanges({
  changes,
  hasPeriods,
  manualPrice,
  amendmentDue,
  onChanged,
}: {
  changes: SerializedDateChange[];
  hasPeriods: boolean;
  manualPrice: boolean;
  /** the next contract will be an amendment */
  amendmentDue: boolean;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [note, setNote] = useState("");
  const [issueAmendment, setIssueAmendment] = useState(true);
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const pending = changes.find((c) => c.status === "pending" && c.source === "guest");
  if (!changes.length) return null;

  const decide = async (id: number, action: "approve" | "reject") => {
    setBusy(true);
    const res = await api<{ contractId: number | null; signUrl: string | null; emailSent: boolean }>(
      `/api/admin/date-changes/${id}`,
      { method: "PUT", json: { action, note: note || null, issueAmendment, notifyGuest } }
    );
    setBusy(false);
    if (!res.success) {
      push(ERRORS[res.error ?? ""] ?? `Erreur : ${res.error}`, "error");
      return;
    }
    push(
      action === "approve"
        ? res.contractId
          ? "Dates modifiées — avenant généré" + (res.emailSent ? " et envoyé au client" : "")
          : "Dates modifiées" + (res.emailSent ? " — client prévenu" : "")
        : "Demande refusée" + (res.emailSent ? " — client prévenu" : "")
    );
    setNote("");
    onChanged();
  };

  return (
    <Card title="📅 Changement de dates">
      {pending && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-semibold text-amber-800">Demande du client</div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Actuel : </span>
              {fmtDate(pending.fromStart)} → {fmtDate(pending.fromEnd)} · {fmtUSD(pending.previousTTC)}
            </div>
            <div>
              <span className="text-slate-500">Demandé : </span>
              <strong>
                {fmtDate(pending.toStart)} → {fmtDate(pending.toEnd)}
              </strong>
              {pending.quotedTTC != null && <> · estimé {fmtUSD(pending.quotedTTC)}</>}
            </div>
          </div>
          {pending.message && (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-white px-3 py-2 text-slate-700">
              « {pending.message} »
            </p>
          )}
          {hasPeriods && <p className="mt-2 text-xs text-amber-800">{ERRORS.has_periods}</p>}
          {manualPrice && !hasPeriods && (
            <p className="mt-2 text-xs text-amber-800">
              Prix final manuel sur ce séjour : il est conservé. Ajustez-le si besoin puis régénérez l&apos;avenant.
            </p>
          )}
          <div className="afield mt-3">
            <label>Message au client (facultatif)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={issueAmendment} onChange={(e) => setIssueAmendment(e.target.checked)} />
              Générer l&apos;avenant (dates libérées, sommes reçues, solde)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} />
              Prévenir le client par email
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy || hasPeriods} onClick={() => decide(pending.id, "approve")} className="abtn-primary">
              ✓ Accepter et déplacer le séjour
            </button>
            <button disabled={busy} onClick={() => decide(pending.id, "reject")} className="abtn-ghost">
              Refuser
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100 text-sm">
        {changes
          .filter((c) => c !== pending)
          .map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {fmtDate(c.fromStart)} → {fmtDate(c.fromEnd)}
                <span className="mx-2 text-slate-400">devient</span>
                {fmtDate(c.toStart)} → {fmtDate(c.toEnd)}
                <span className="ml-2 text-xs text-slate-400">
                  {c.source === "guest" ? "demande client" : "modifié dans l'éditeur"}
                  {c.decidedBy ? ` · ${c.decidedBy}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs">
                {c.status === "approved" && (c.contractId || amendmentDue) && (
                  <span className={c.contractId ? "text-emerald-600" : "text-amber-600"}>
                    {c.contractId ? "avenant émis" : "avenant à générer"}
                  </span>
                )}
                <span className={`rounded px-2 py-0.5 font-medium ${STATUS[c.status]?.cls ?? ""}`}>
                  {STATUS[c.status]?.label ?? c.status}
                </span>
              </span>
            </li>
          ))}
      </ul>
    </Card>
  );
}
