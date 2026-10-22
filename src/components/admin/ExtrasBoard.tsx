"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtUSD, Modal, Spinner, useToast } from "./ui";

export interface CatalogExtra {
  id: number;
  nameEn: string;
  nameFr: string;
  descriptionEn: string | null;
  descriptionFr: string | null;
  price: number;
  unit: string;
  isActive: boolean;
  guestBookable: boolean;
  sortOrder: number;
}

export const UNIT_LABELS: Record<string, string> = {
  stay: "par séjour",
  night: "par nuit",
  person: "par personne",
  unit: "l'unité",
};

const EMPTY = {
  nameEn: "",
  nameFr: "",
  descriptionEn: "",
  descriptionFr: "",
  price: "",
  unit: "stay",
  isActive: true,
  guestBookable: true,
  sortOrder: 0,
};

export function ExtrasBoard() {
  const { push } = useToast();
  const [extras, setExtras] = useState<CatalogExtra[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CatalogExtra | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    api<{ extras: CatalogExtra[] }>("/api/admin/extras").then(
      (d) => d.success && setExtras(d.extras)
    );
  }, []);
  useEffect(load, [load]);

  const openModal = (x: CatalogExtra | null) => {
    setEditing(x);
    setForm(
      x
        ? {
            nameEn: x.nameEn,
            nameFr: x.nameFr,
            descriptionEn: x.descriptionEn ?? "",
            descriptionFr: x.descriptionFr ?? "",
            price: String(x.price),
            unit: x.unit,
            isActive: x.isActive,
            guestBookable: x.guestBookable,
            sortOrder: x.sortOrder,
          }
        : EMPTY
    );
    setModal(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      descriptionEn: form.descriptionEn || null,
      descriptionFr: form.descriptionFr || null,
      price: parseFloat(form.price) || 0,
    };
    const res = editing
      ? await api(`/api/admin/extras/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/extras", { method: "POST", json: payload });
    if (res.success) {
      push("Extra enregistré");
      setModal(false);
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/extras/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Extra supprimé — les séjours qui l'ont déjà le gardent");
      setModal(false);
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Extras</h1>
          <p className="text-xs text-slate-500">
            Chef, location de voiture, bateau, courses à l&apos;arrivée… Ajoutez-les à un séjour depuis la
            réservation ; ceux marqués « client » peuvent être demandés depuis l&apos;espace client.
          </p>
        </div>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Extra
        </button>
      </div>

      {!extras ? (
        <Spinner />
      ) : extras.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">Aucun extra dans le catalogue</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {extras.map((x) => (
            <button
              key={x.id}
              onClick={() => openModal(x)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-navy ${
                x.isActive ? "border-slate-200" : "border-slate-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                    {x.nameFr}
                    {x.guestBookable && x.isActive && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-700">
                        CLIENT
                      </span>
                    )}
                    {!x.isActive && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500">
                        INACTIF
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{x.nameEn}</div>
                  {x.descriptionFr && <p className="mt-1 text-sm text-slate-500">{x.descriptionFr}</p>}
                </div>
                <div className="text-right">
                  <div className="font-display text-xl text-gold-dark">
                    {x.price > 0 ? fmtUSD(x.price) : "sur devis"}
                  </div>
                  <div className="text-[0.65rem] text-slate-400">{UNIT_LABELS[x.unit] ?? x.unit}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? editing.nameFr : "Nouvel extra"}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="afield">
            <label>Nom (FR) *</label>
            <input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
          </div>
          <div className="afield">
            <label>Nom (EN) *</label>
            <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </div>
          <div className="afield">
            <label>Description (FR)</label>
            <textarea
              rows={2}
              value={form.descriptionFr}
              onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Description (EN)</label>
            <textarea
              rows={2}
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Prix ($)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={form.price}
              placeholder="0 = sur devis"
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Unité</label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {Object.entries(UNIT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="afield">
            <label>Ordre d&apos;affichage</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-navy"
              />
              Actif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.guestBookable}
                onChange={(e) => setForm({ ...form, guestBookable: e.target.checked })}
                className="accent-emerald-600"
              />
              Proposé dans l&apos;espace client
            </label>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          {editing ? (
            <ConfirmButton className="text-xs text-red-500 hover:underline" onConfirm={() => remove(editing.id)}>
              Supprimer
            </ConfirmButton>
          ) : (
            <span />
          )}
          <button onClick={save} className="abtn-primary">
            Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
