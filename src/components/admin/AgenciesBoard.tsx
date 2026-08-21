"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtUSD, Modal, Spinner, useToast } from "./ui";

interface AgencyRow {
  id: number;
  name: string;
  code: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  commissionPercent: number;
  isActive: boolean;
  notes: string | null;
  stats: { reservations: number; volume: number; commissions: number };
}

const EMPTY = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  commissionPercent: 25,
  isActive: true,
  notes: "",
};

export function AgenciesBoard() {
  const { push } = useToast();
  const [agencies, setAgencies] = useState<AgencyRow[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<AgencyRow | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    api<{ agencies: AgencyRow[] }>("/api/admin/agencies").then(
      (d) => d.success && setAgencies(d.agencies)
    );
  }, []);
  useEffect(load, [load]);

  const openModal = (a: AgencyRow | null) => {
    setEditing(a);
    setForm(
      a
        ? {
            name: a.name,
            contactName: a.contactName ?? "",
            email: a.email ?? "",
            phone: a.phone ?? "",
            commissionPercent: a.commissionPercent,
            isActive: a.isActive,
            notes: a.notes ?? "",
          }
        : EMPTY
    );
    setModal(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      contactName: form.contactName || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
    };
    const res = editing
      ? await api(`/api/admin/agencies/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/agencies", { method: "POST", json: payload });
    if (res.success) {
      push("Agence enregistrée");
      setModal(false);
      load();
    } else push(res.error === "name_exists" ? "Ce nom existe déjà" : `Erreur : ${res.error}`, "error");
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/agencies/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Agence supprimée");
      setModal(false);
      load();
    }
  };

  const example = 20000;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Agences partenaires</h1>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Agence
        </button>
      </div>

      <Card>
        {!agencies ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Agence</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Commission</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Réservations</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Volume TTC</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Commissions</th>
                  <th className="pb-2.5 font-medium">Actif</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => openModal(a)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-slate-800">{a.name}</span>
                      {a.contactName && (
                        <div className="text-xs text-slate-400">
                          {a.contactName} {a.email && `· ${a.email}`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-center font-semibold text-navy">
                      {a.commissionPercent}%
                    </td>
                    <td className="py-3 pr-3 text-center">{a.stats.reservations}</td>
                    <td className="py-3 pr-3 text-right">{fmtUSD(a.stats.volume)}</td>
                    <td className="py-3 pr-3 text-right text-red-600">
                      -{fmtUSD(a.stats.commissions)}
                    </td>
                    <td className="py-3">{a.isActive ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? editing.name : "Nouvelle agence"}>
        <div className="space-y-3">
          <div className="afield">
            <label>Nom *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="afield">
              <label>Contact</label>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="afield">
              <label>Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="afield">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="afield">
            <label>Commission (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.commissionPercent}
              onChange={(e) => setForm({ ...form, commissionPercent: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-[0.65rem] text-slate-400">
              Ex. sur {fmtUSD(example)} : commission {fmtUSD((example * form.commissionPercent) / 100)} → net{" "}
              {fmtUSD(example - (example * form.commissionPercent) / 100)}
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-navy"
            />
            Agence active
          </label>
          <div className="afield">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            {editing ? (
              <ConfirmButton
                className="text-xs text-red-500 hover:underline"
                onConfirm={() => remove(editing.id)}
              >
                Supprimer
              </ConfirmButton>
            ) : (
              <span />
            )}
            <button onClick={save} className="abtn-primary">
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
