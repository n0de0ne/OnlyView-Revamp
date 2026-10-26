"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, Modal, Spinner, useToast } from "./ui";
import { extraThumb, moneyIn } from "@/lib/extras";

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
  partnerId: number | null;
  partnerName: string | null;
  currency: string;
  categoryEn: string | null;
  categoryFr: string | null;
  imageUrl: string | null;
  synced: boolean;
}

interface SyncStatus {
  lastRunAt: string;
  ok: boolean;
  error?: string;
  lastSuccessAt?: string;
  items?: number;
  created?: number;
  updated?: number;
  hidden?: number;
  changes?: string[];
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

interface Partner {
  id: number;
  kind: string;
  name: string;
  currency: string;
}

/** rental companies count by the day, not the night */
const PROVIDER_UNIT_LABELS: Record<string, string> = { night: "par jour" };

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
  partnerId: "",
  categoryFr: "",
  categoryEn: "",
  imageUrl: "",
};

export function ExtrasBoard() {
  const { push } = useToast();
  const [extras, setExtras] = useState<CatalogExtra[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CatalogExtra | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filter, setFilter] = useState("");
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    api<{ extras: CatalogExtra[] }>("/api/admin/extras").then(
      (d) => d.success && setExtras(d.extras)
    );
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ status: SyncStatus | null }>("/api/admin/extras/sync").then((d) => d.success && setSync(d.status));
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    const res = await api<{ status: SyncStatus }>("/api/admin/extras/sync", { method: "POST" }).finally(() =>
      setSyncing(false)
    );
    if (!res.success) return push(`Erreur : ${res.error}`, "error");
    setSync(res.status);
    if (res.status.ok) {
      push("Catalogue St Barth Provider à jour");
      load();
    } else push(`Synchro annulée : ${res.status.error}`, "error");
  };
  // rental companies (Conciergerie → Prestataires, activity "Location de matériel")
  useEffect(() => {
    api<{ items: Partner[] }>("/api/admin/concierge/partners").then(
      (d) => d.success && setPartners((d.items ?? []).filter((p) => p.kind === "extras"))
    );
  }, []);

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
            partnerId: x.partnerId ? String(x.partnerId) : "",
            categoryFr: x.categoryFr ?? "",
            categoryEn: x.categoryEn ?? "",
            imageUrl: x.imageUrl ?? "",
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
      partnerId: form.partnerId ? parseInt(form.partnerId, 10) : null,
      categoryFr: form.categoryFr || null,
      categoryEn: form.categoryEn || null,
      imageUrl: form.imageUrl || null,
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

  const q = filter.trim().toLowerCase();
  const groups = Object.entries(
    (extras ?? [])
      .filter((x) => !q || [x.nameFr, x.nameEn, x.categoryFr, x.partnerName].join(" ").toLowerCase().includes(q))
      .reduce<Record<string, CatalogExtra[]>>((acc, x) => {
        (acc[x.categoryFr || "Villa"] ??= []).push(x);
        return acc;
      }, {})
  );
  const formPartner = partners.find((p) => String(p.id) === form.partnerId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Extras</h1>
          <p className="text-xs text-slate-500">
            Services et location de matériel (St Barth Provider…). Ajoutez-les à un séjour depuis la réservation ;
            ceux marqués « client » peuvent être demandés depuis l&apos;espace client. Un extra rattaché à un
            prestataire est affiché dans sa devise et réglé directement à lui (hors solde).
          </p>
        </div>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Extra
        </button>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-slate-800">Synchro St Barth Provider</div>
            <p className="text-xs text-slate-500">
              Chaque jour, le catalogue est recopié depuis leur site de réservation (booking.stbarthprovider.com) :
              nouveaux articles ajoutés, prix, noms, photos et catégories mis à jour, articles retirés masqués.
            </p>
            {sync ? (
              <p className={`mt-1 text-xs ${sync.ok ? "text-emerald-700" : "text-red-600"}`}>
                {sync.ok
                  ? `Dernière synchro ${when(sync.lastRunAt)} — ${sync.items} articles, ${sync.created} nouveaux, ${sync.updated} modifiés, ${sync.hidden} masqués.`
                  : `Dernière tentative ${when(sync.lastRunAt)} annulée (${sync.error}), catalogue inchangé${
                      sync.lastSuccessAt ? ` — dernière réussie ${when(sync.lastSuccessAt)}` : ""
                    }.`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Pas encore synchronisé.</p>
            )}
            {sync?.ok && !!sync.changes?.length && (
              <details className="mt-1 text-xs text-slate-500">
                <summary className="cursor-pointer">Changements</summary>
                <ul className="mt-1 list-inside list-disc">
                  {sync.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button onClick={syncNow} disabled={syncing} className="abtn-primary shrink-0">
            {syncing ? "Synchro…" : "Synchroniser maintenant"}
          </button>
        </div>
      </Card>

      {!extras ? (
        <Spinner />
      ) : extras.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">Aucun extra dans le catalogue</p>
        </Card>
      ) : (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Rechercher…"
            className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-72"
          />
          {groups.map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {cat} <span className="font-normal">({list.length})</span>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => openModal(x)}
                    className={`rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition hover:border-navy ${
                      x.isActive ? "border-slate-200" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {x.imageUrl && (
                        <img
                          src={extraThumb(x.imageUrl)}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      )}
                      <div className="min-w-0 flex-1">
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
                        <div className="text-xs text-slate-400">
                          {x.nameEn}
                          {x.partnerName && <> · {x.partnerName}</>}
                        </div>
                        {x.descriptionFr && <p className="mt-1 text-sm text-slate-500">{x.descriptionFr}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-xl text-gold-dark">
                          {x.price > 0 ? moneyIn(x.price, x.currency) : "sur devis"}
                        </div>
                        <div className="text-[0.65rem] text-slate-400">
                          {x.partnerId ? PROVIDER_UNIT_LABELS[x.unit] ?? UNIT_LABELS[x.unit] : UNIT_LABELS[x.unit] ?? x.unit}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? editing.nameFr : "Nouvel extra"}
        wide
      >
        {editing?.synced && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Article synchronisé avec le site de St Barth Provider : nom, catégorie, prix, photo et ordre sont
            remplacés chaque jour par ceux du site. Pour le retirer de l&apos;espace client, décochez « Proposé dans
            l&apos;espace client » (ce choix est conservé).
          </p>
        )}
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
            <label>Prix ({formPartner?.currency === "EUR" ? "€" : "$"})</label>
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
                  {(formPartner && PROVIDER_UNIT_LABELS[k]) || v}
                </option>
              ))}
            </select>
          </div>
          <div className="afield">
            <label>Prestataire (réglé directement par le client)</label>
            <select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
              <option value="">— la villa (ajouté au solde, en $) —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="afield">
            <label>Photo (URL)</label>
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <div className="afield">
            <label>Catégorie (FR)</label>
            <input
              value={form.categoryFr}
              placeholder="Bébé, Piscine, Plage…"
              onChange={(e) => setForm({ ...form, categoryFr: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Catégorie (EN)</label>
            <input
              value={form.categoryEn}
              placeholder="Baby, Pool, Beach…"
              onChange={(e) => setForm({ ...form, categoryEn: e.target.value })}
            />
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
