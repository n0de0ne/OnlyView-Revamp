"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, fmtUSD, Modal, Spinner, useToast } from "./ui";

interface Promo {
  id: number;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minNights: number | null;
  maxNights: number | null;
  validFrom: string | null;
  validUntil: string | null;
  stayStartFrom: string | null;
  stayStartUntil: string | null;
  mustIncludeDate: string | null;
  promoCode: string | null;
  isActive: boolean;
  priority: number;
  showOnWebsite: boolean;
  maxUses: number | null;
  usedCount: number;
  notes: string | null;
}

const EMPTY = {
  name: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minNights: "",
  maxNights: "",
  validFrom: "",
  validUntil: "",
  stayStartFrom: "",
  stayStartUntil: "",
  mustIncludeDate: "",
  promoCode: "",
  isActive: true,
  priority: 0,
  showOnWebsite: false,
  maxUses: "",
  notes: "",
};

export function PromotionsBoard() {
  const { push } = useToast();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    api<{ promotions: Promo[] }>("/api/admin/promotions").then(
      (d) => d.success && setPromos(d.promotions)
    );
  }, []);
  useEffect(load, [load]);

  const openModal = (p: Promo | null) => {
    setEditing(p);
    setForm(
      p
        ? {
            name: p.name,
            description: p.description ?? "",
            discountType: p.discountType,
            discountValue: String(p.discountValue),
            minNights: p.minNights != null ? String(p.minNights) : "",
            maxNights: p.maxNights != null ? String(p.maxNights) : "",
            validFrom: p.validFrom ?? "",
            validUntil: p.validUntil ?? "",
            stayStartFrom: p.stayStartFrom ?? "",
            stayStartUntil: p.stayStartUntil ?? "",
            mustIncludeDate: p.mustIncludeDate ?? "",
            promoCode: p.promoCode ?? "",
            isActive: p.isActive,
            priority: p.priority,
            showOnWebsite: p.showOnWebsite,
            maxUses: p.maxUses != null ? String(p.maxUses) : "",
            notes: p.notes ?? "",
          }
        : EMPTY
    );
    setModal(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue) || 0,
      minNights: form.minNights ? parseInt(form.minNights) : null,
      maxNights: form.maxNights ? parseInt(form.maxNights) : null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      stayStartFrom: form.stayStartFrom || null,
      stayStartUntil: form.stayStartUntil || null,
      mustIncludeDate: form.mustIncludeDate || null,
      promoCode: form.promoCode || null,
      isActive: form.isActive,
      priority: form.priority,
      showOnWebsite: form.showOnWebsite,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      notes: form.notes || null,
    };
    const res = editing
      ? await api(`/api/admin/promotions/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/promotions", { method: "POST", json: payload });
    if (res.success) {
      push("Promotion enregistrée");
      setModal(false);
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/promotions/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Promotion supprimée");
      setModal(false);
      load();
    }
  };

  const discountLabel = (p: Promo) =>
    p.discountType === "percent"
      ? `-${p.discountValue}%`
      : p.discountType === "fixed"
        ? `-${fmtUSD(p.discountValue)}`
        : `${p.discountValue} nuit(s) offerte(s)`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Promotions</h1>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Promotion
        </button>
      </div>

      {!promos ? (
        <Spinner />
      ) : promos.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">Aucune promotion</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {promos.map((p) => (
            <button
              key={p.id}
              onClick={() => openModal(p)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-navy ${
                p.isActive ? "border-slate-200" : "border-slate-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">
                    {p.name}
                    {p.showOnWebsite && (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-700">
                        SITE
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    {p.promoCode && <span>Code : <b className="text-gold-dark">{p.promoCode}</b></span>}
                    {p.minNights && <span>min {p.minNights}n</span>}
                    {p.validUntil && <span>réserver avant {fmtDate(p.validUntil)}</span>}
                    {p.stayStartFrom && <span>séjours dès {fmtDate(p.stayStartFrom)}</span>}
                    {p.maxUses != null && (
                      <span>
                        {p.usedCount}/{p.maxUses} utilisations
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-display text-2xl text-gold-dark">{discountLabel(p)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? editing.name : "Nouvelle promotion"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="afield sm:col-span-2">
            <label>Nom *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="afield sm:col-span-2">
            <label>Description (visible sur le site si activé)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="afield">
            <label>Type de remise</label>
            <select
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value })}
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe ($)</option>
              <option value="free_nights">Nuits offertes</option>
            </select>
          </div>
          <div className="afield">
            <label>Valeur</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Nuits min.</label>
            <input type="number" min="0" value={form.minNights} onChange={(e) => setForm({ ...form, minNights: e.target.value })} />
          </div>
          <div className="afield">
            <label>Nuits max.</label>
            <input type="number" min="0" value={form.maxNights} onChange={(e) => setForm({ ...form, maxNights: e.target.value })} />
          </div>
          <div className="afield">
            <label>Réservable du</label>
            <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
          </div>
          <div className="afield">
            <label>Réservable jusqu&apos;au</label>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          </div>
          <div className="afield">
            <label>Séjours commençant du</label>
            <input type="date" value={form.stayStartFrom} onChange={(e) => setForm({ ...form, stayStartFrom: e.target.value })} />
          </div>
          <div className="afield">
            <label>… jusqu&apos;au</label>
            <input type="date" value={form.stayStartUntil} onChange={(e) => setForm({ ...form, stayStartUntil: e.target.value })} />
          </div>
          <div className="afield">
            <label>Doit inclure la date</label>
            <input type="date" value={form.mustIncludeDate} onChange={(e) => setForm({ ...form, mustIncludeDate: e.target.value })} />
          </div>
          <div className="afield">
            <label>Code promo (optionnel)</label>
            <input
              value={form.promoCode}
              placeholder="Ex : SUMMER26"
              onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="afield">
            <label>Utilisations max.</label>
            <input type="number" min="0" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </div>
          <div className="afield">
            <label>Priorité</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-navy"
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.showOnWebsite}
              onChange={(e) => setForm({ ...form, showOnWebsite: e.target.checked })}
              className="accent-emerald-600"
            />
            Afficher sur le site (page tarifs)
          </label>
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
