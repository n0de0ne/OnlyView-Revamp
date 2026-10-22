"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, fmtUSD, Modal, Spinner, useToast } from "./ui";

interface Period {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  mode: string;
  rate2: number | null;
  rate3: number | null;
  rate4: number | null;
  adjustPercent: number | null;
  minStay: number | null;
  isActive: boolean;
  showOnWebsite: boolean;
  notes: string | null;
}

const EMPTY = {
  name: "",
  startDate: "",
  endDate: "",
  mode: "fixed",
  rate2: "",
  rate3: "",
  rate4: "",
  adjustPercent: "",
  minStay: "",
  isActive: true,
  showOnWebsite: false,
  notes: "",
};

const numOrNull = (v: string) => (v.trim() === "" ? null : parseFloat(v));

export function RatePeriodsBoard() {
  const { push } = useToast();
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    api<{ periods: Period[] }>("/api/admin/rate-periods").then(
      (d) => d.success && setPeriods(d.periods)
    );
  }, []);
  useEffect(load, [load]);

  const openModal = (p: Period | null) => {
    setEditing(p);
    setForm(
      p
        ? {
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            mode: p.mode,
            rate2: p.rate2 != null ? String(p.rate2) : "",
            rate3: p.rate3 != null ? String(p.rate3) : "",
            rate4: p.rate4 != null ? String(p.rate4) : "",
            adjustPercent: p.adjustPercent != null ? String(p.adjustPercent) : "",
            minStay: p.minStay != null ? String(p.minStay) : "",
            isActive: p.isActive,
            showOnWebsite: p.showOnWebsite,
            notes: p.notes ?? "",
          }
        : EMPTY
    );
    setModal(true);
  };

  const save = async () => {
    const fixed = form.mode === "fixed";
    const payload = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      mode: form.mode,
      rate2: fixed ? numOrNull(form.rate2) : null,
      rate3: fixed ? numOrNull(form.rate3) : null,
      rate4: fixed ? numOrNull(form.rate4) : null,
      adjustPercent: fixed ? null : numOrNull(form.adjustPercent),
      minStay: form.minStay ? parseInt(form.minStay, 10) : null,
      isActive: form.isActive,
      showOnWebsite: form.showOnWebsite,
      notes: form.notes || null,
    };
    const res = editing
      ? await api(`/api/admin/rate-periods/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/rate-periods", { method: "POST", json: payload });
    if (res.success) {
      push("Période enregistrée — appliquée aux nouveaux devis");
      setModal(false);
      load();
    } else {
      const msg = res.error?.includes("end_before_start")
        ? "La dernière nuit doit suivre la première"
        : res.error?.includes("missing_rate")
          ? "Indiquez au moins un tarif (ou un pourcentage)"
          : res.error;
      push(`Erreur : ${msg}`, "error");
    }
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/rate-periods/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Période supprimée");
      setModal(false);
      load();
    }
  };

  const rateLabel = (p: Period) =>
    p.mode === "percent"
      ? `${(p.adjustPercent ?? 0) >= 0 ? "+" : ""}${p.adjustPercent ?? 0}% sur la saison`
      : [
          p.rate2 != null && `2ch ${fmtUSD(p.rate2)}`,
          p.rate3 != null && `3ch ${fmtUSD(p.rate3)}`,
          p.rate4 != null && `4ch ${fmtUSD(p.rate4)}`,
        ]
          .filter(Boolean)
          .join(" · ") + " / sem.";

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tarifs par date</h1>
          <p className="text-xs text-slate-500">
            Semaines d&apos;événement (Bucket, carnaval, St Barth Cata Cup…) ou périodes creuses : les nuits
            couvertes remplacent le tarif de la saison. Les dates des saisons se règlent dans{" "}
            <Link href="/admin/settings" className="text-navy underline">
              Réglages
            </Link>
            .
          </p>
        </div>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Période
        </button>
      </div>

      {!periods ? (
        <Spinner />
      ) : periods.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">
            Aucune période spéciale — toutes les nuits suivent les saisons.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {periods.map((p) => {
            const past = p.endDate < today;
            return (
              <button
                key={p.id}
                onClick={() => openModal(p)}
                className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-navy ${
                  p.isActive && !past ? "border-slate-200" : "border-slate-100 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                  {p.name}
                  {p.showOnWebsite && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-700">
                      SITE
                    </span>
                  )}
                  {!p.isActive && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500">
                      INACTIVE
                    </span>
                  )}
                  {past && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500">
                      PASSÉE
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Nuits du {fmtDate(p.startDate)} au {fmtDate(p.endDate)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-gold-dark">{rateLabel(p)}</span>
                  {p.minStay && <span>min {p.minStay} nuits</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? editing.name : "Nouvelle période"}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="afield sm:col-span-2">
            <label>Nom * (affiché dans le devis)</label>
            <input
              value={form.name}
              placeholder="Ex : Bucket Regatta"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Première nuit *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Dernière nuit *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
            <span className="text-[0.65rem] text-slate-400">
              incluse — le départ se fait le lendemain
            </span>
          </div>
          <div className="afield sm:col-span-2">
            <label>Type de tarif</label>
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="fixed">Tarifs hebdomadaires fixes ($)</option>
              <option value="percent">± % sur le tarif de la saison</option>
            </select>
          </div>
          {form.mode === "fixed" ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              {(["rate2", "rate3", "rate4"] as const).map((k, i) => (
                <div key={k} className="afield">
                  <label>{i + 2} chambres ($ / sem.)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form[k]}
                    placeholder="tarif saison"
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
              <span className="text-[0.65rem] text-slate-400 sm:col-span-3">
                Laisser vide pour garder le tarif de la saison à ce nombre de chambres.
              </span>
            </div>
          ) : (
            <div className="afield">
              <label>Variation (%)</label>
              <input
                type="number"
                step="1"
                value={form.adjustPercent}
                placeholder="Ex : 25 ou -15"
                onChange={(e) => setForm({ ...form, adjustPercent: e.target.value })}
              />
            </div>
          )}
          <div className="afield">
            <label>Séjour minimum (nuits)</label>
            <input
              type="number"
              min="1"
              value={form.minStay}
              placeholder="règle habituelle"
              onChange={(e) => setForm({ ...form, minStay: e.target.value })}
            />
          </div>
          <div className="afield sm:col-span-2">
            <label>Notes internes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
            Afficher sur la page Tarifs
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
