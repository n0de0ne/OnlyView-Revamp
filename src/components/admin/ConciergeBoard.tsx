"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Conciergerie — the catalog the guest portal offers: restaurants (pins of the
 * island map), boats, private-chef formulas, taxis, and the providers behind
 * them. Guests' requests land on their stay, under Extras, as "Demandé".
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Card, ConfirmButton, Modal, Spinner, useToast } from "./ui";

type Tab = "restaurants" | "boats" | "chef-offers" | "taxis" | "partners";
type Item = Record<string, unknown> & { id: number; name: string; isActive: boolean };
type Partner = { id: number; name: string; isActive: boolean; currency: string };

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "price" | "checkbox" | "select" | "partner";
  options?: Array<[string, string]>;
  wide?: boolean;
  required?: boolean;
};

const CHEF_CATEGORY_LABELS: Record<string, string> = {
  dinner: "Dîner",
  brunch: "Brunch",
  buffet: "Buffet",
  cocktail: "Cocktail / apéritif",
  weekly_chef: "Chef à la semaine",
};
const PRICE_TYPE_LABELS: Record<string, string> = {
  per_person: "par personne",
  per_day: "par jour",
  quote: "sur devis",
};
const BOOKING_LABELS: Record<string, string> = {
  concierge: "Réservé par nous",
  direct: "Réservation en ligne",
  none: "Sans réservation",
};

const FIELDS: Record<Exclude<Tab, "restaurants">, Field[]> = {
  boats: [
    { key: "name", label: "Nom", required: true },
    { key: "partnerId", label: "Loueur", type: "partner" },
    { key: "boatType", label: "Type (catamaran, yacht…)" },
    { key: "length", label: "Longueur (ex. 55')" },
    { key: "capacity", label: "Passagers max", type: "number" },
    { key: "sortOrder", label: "Ordre d'affichage", type: "number" },
    { key: "descriptionFr", label: "Description (FR)", type: "textarea" },
    { key: "descriptionEn", label: "Description (EN)", type: "textarea" },
    { key: "includesFr", label: "Inclus (FR)", type: "textarea" },
    { key: "includesEn", label: "Inclus (EN)", type: "textarea" },
    { key: "priceHalfDay", label: "Demi-journée", type: "price" },
    { key: "priceFullDay", label: "Journée", type: "price" },
    { key: "priceSunset", label: "Sunset", type: "price" },
    { key: "priceCruisingDay", label: "Journée croisière", type: "price" },
    { key: "priceTransfer", label: "Transfert", type: "price" },
    { key: "transferAnguilla", label: "Transfert Anguilla", type: "price" },
    { key: "transferSbhSxmDay", label: "SBH → SXM jour", type: "price" },
    { key: "transferSbhSxmNight", label: "SBH → SXM nuit", type: "price" },
    { key: "transferSxmSbhDay", label: "SXM → SBH jour", type: "price" },
    { key: "transferSxmSbhNight", label: "SXM → SBH nuit", type: "price" },
    { key: "imageUrl", label: "Photo (URL)", wide: true },
    { key: "isActive", label: "Proposé aux clients", type: "checkbox" },
  ],
  "chef-offers": [
    { key: "name", label: "Nom", required: true },
    { key: "partnerId", label: "Chef / traiteur", type: "partner" },
    {
      key: "category",
      label: "Catégorie",
      type: "select",
      options: Object.entries(CHEF_CATEGORY_LABELS),
    },
    { key: "formulaName", label: "Formule" },
    { key: "price", label: "Prix", type: "price" },
    { key: "priceType", label: "Tarif", type: "select", options: Object.entries(PRICE_TYPE_LABELS) },
    { key: "minimumGuests", label: "Minimum de convives", type: "number" },
    { key: "duration", label: "Durée / service (ex. 3h incluses)" },
    { key: "descriptionFr", label: "Description (FR)", type: "textarea" },
    { key: "descriptionEn", label: "Description (EN)", type: "textarea" },
    { key: "menuFr", label: "Menu (FR)", type: "textarea" },
    { key: "menuEn", label: "Menu (EN)", type: "textarea" },
    { key: "notes", label: "Notes internes", type: "textarea", wide: true },
    { key: "webPageUrl", label: "Page du prestataire (URL)" },
    { key: "imageUrl", label: "Photo (URL)" },
    { key: "sortOrder", label: "Ordre d'affichage", type: "number" },
    { key: "holidaySurcharge", label: "Supplément jours fériés", type: "checkbox" },
    { key: "isActive", label: "Proposé aux clients", type: "checkbox" },
  ],
  taxis: [
    { key: "name", label: "Nom", required: true },
    { key: "phone", label: "Téléphone (format international, ex. +590690…)", required: true },
    { key: "displayPhone", label: "Numéro affiché (ex. 06 90 …)" },
    { key: "zone", label: "Quartier" },
    { key: "sortOrder", label: "Ordre d'affichage", type: "number" },
    { key: "hasWhatsapp", label: "Joignable sur WhatsApp", type: "checkbox" },
    { key: "isActive", label: "Affiché aux clients", type: "checkbox" },
  ],
  partners: [
    { key: "name", label: "Nom", required: true },
    { key: "kind", label: "Activité", type: "select", options: [["boat", "Bateaux"], ["chef", "Chef à domicile"]] },
    { key: "contactName", label: "Contact" },
    { key: "phone", label: "Téléphone" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "email", label: "E-mail" },
    { key: "website", label: "Site web (URL)" },
    { key: "location", label: "Adresse" },
    { key: "currency", label: "Devise des prix", type: "select", options: [["EUR", "Euro (€)"], ["USD", "Dollar ($)"]] },
    { key: "notes", label: "Notes internes", type: "textarea", wide: true },
    { key: "isActive", label: "Actif (désactivé = ses bateaux / menus sont masqués aux clients)", type: "checkbox", wide: true },
  ],
};

const DEFAULTS: Record<Exclude<Tab, "restaurants">, Record<string, unknown>> = {
  boats: { capacity: 10, sortOrder: 0, isActive: true },
  "chef-offers": { category: "dinner", priceType: "per_person", minimumGuests: 4, sortOrder: 0, isActive: true, holidaySurcharge: false },
  taxis: { sortOrder: 0, hasWhatsapp: true, isActive: true },
  partners: { kind: "boat", currency: "EUR", isActive: true },
};

const TABS: Array<[Tab, string]> = [
  ["restaurants", "🍽️ Restaurants"],
  ["boats", "⛵ Bateaux"],
  ["chef-offers", "👨‍🍳 Chef"],
  ["taxis", "🚕 Taxis"],
  ["partners", "🤝 Prestataires"],
];

const money = (n: number, currency = "EUR") =>
  (currency === "EUR" ? "€" : "$") + Math.round(n).toLocaleString("en-US");

export function ConciergeBoard() {
  const [tab, setTab] = useState<Tab>("restaurants");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Conciergerie</h1>
        <p className="text-sm text-slate-500">
          Ce que l&apos;espace client propose pendant le séjour. Les demandes des clients arrivent dans leur
          réservation, onglet Extras, au statut « Demandé » — avec le contact du prestataire dans l&apos;e-mail.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              tab === k ? "bg-navy text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "restaurants" ? <RestaurantsTab /> : <CatalogTab key={tab} type={tab} />}
    </div>
  );
}

/* ───────────────────────── restaurants ───────────────────────── */

interface Restaurant {
  id: number;
  name: string;
  zone: string | null;
  category: string;
  isActive: boolean;
  bookingMode: string | null;
  bookingUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cuisineFr: string | null;
}

function RestaurantsTab() {
  const { push } = useToast();
  const [items, setItems] = useState<Restaurant[] | null>(null);
  const load = useCallback(() => {
    api<{ places: Restaurant[] }>("/api/admin/map-places").then(
      (d) => d.success && setItems(d.places.filter((p) => p.category === "restaurant"))
    );
  }, []);
  useEffect(load, [load]);

  const setMode = async (r: Restaurant, bookingMode: string) => {
    const res = await api(`/api/admin/map-places/${r.id}`, {
      method: "PUT",
      json: { bookingMode: bookingMode || null },
    });
    if (res.success) {
      push("Restaurant enregistré");
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  if (!items) return <Spinner />;
  return (
    <Card className="overflow-hidden !p-0">
      <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        Les restaurants sont les repères de la{" "}
        <Link href="/admin/map" className="text-navy underline">
          carte de l&apos;île
        </Link>{" "}
        : leur fiche (photo, cuisine, contacts, lien de réservation) se modifie là-bas. Choisissez ici comment
        chacun est proposé aux clients.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Restaurant</th>
              <th className="px-4 py-2.5">Contacts</th>
              <th className="px-4 py-2.5">Dans l&apos;espace client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    {[r.zone, r.cuisineFr].filter(Boolean).join(" · ")}
                    {!r.isActive && " · masqué sur la carte"}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {r.phone && <div>☎ {r.phone}</div>}
                  {r.whatsapp && <div>WhatsApp {r.whatsapp}</div>}
                  {r.email && <div>{r.email}</div>}
                  {r.bookingUrl && (
                    <a href={r.bookingUrl} target="_blank" rel="noopener" className="text-navy underline">
                      Réservation en ligne ↗
                    </a>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={r.bookingMode ?? ""}
                    onChange={(e) => setMode(r, e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="">Non proposé</option>
                    {Object.entries(BOOKING_LABELS).map(([k, v]) => (
                      <option key={k} value={k} disabled={k === "direct" && !r.bookingUrl}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ───────────────────────── boats, chef, taxis, partners ───────────────────────── */

function summary(type: Exclude<Tab, "restaurants">, x: Item, partners: Map<number, Partner>) {
  const partner = typeof x.partnerId === "number" ? partners.get(x.partnerId) : undefined;
  const cur = partner?.currency ?? "EUR";
  switch (type) {
    case "boats": {
      const from = [x.priceHalfDay, x.priceFullDay, x.priceSunset, x.priceTransfer].filter(
        (v): v is number => typeof v === "number"
      );
      return {
        sub: [partner?.name, x.boatType, x.length, `${x.capacity} pers.`].filter(Boolean).join(" · "),
        right: from.length ? `dès ${money(Math.min(...from), cur)}` : "sur devis",
        warn: partner && !partner.isActive ? "loueur inactif" : null,
      };
    }
    case "chef-offers":
      return {
        sub: [partner?.name, CHEF_CATEGORY_LABELS[x.category as string], `min. ${x.minimumGuests} pers.`]
          .filter(Boolean)
          .join(" · "),
        right:
          typeof x.price === "number"
            ? `${money(x.price, cur)} ${PRICE_TYPE_LABELS[x.priceType as string] ?? ""}`
            : "sur devis",
        warn: partner && !partner.isActive ? "chef inactif" : null,
      };
    case "taxis":
      return {
        sub: [x.displayPhone ?? x.phone, x.zone, x.hasWhatsapp ? "WhatsApp" : null].filter(Boolean).join(" · "),
        right: "",
        warn: null,
      };
    case "partners": {
      const c = x._count as { boats: number; chefOffers: number } | undefined;
      return {
        sub: [x.kind === "boat" ? "Bateaux" : "Chef", x.phone, x.email].filter(Boolean).join(" · "),
        right: x.kind === "boat" ? `${c?.boats ?? 0} bateaux` : `${c?.chefOffers ?? 0} formules`,
        warn: null,
      };
    }
  }
}

function CatalogTab({ type }: { type: Exclude<Tab, "restaurants"> }) {
  const { push } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; draft: Record<string, unknown> } | null>(null);
  const fields = FIELDS[type];

  const load = useCallback(() => {
    api<{ items: Item[]; partners?: Partner[] }>(`/api/admin/concierge/${type}`).then((d) => {
      if (!d.success) return;
      setItems(d.items);
      setPartners(d.partners ?? []);
    });
  }, [type]);
  useEffect(load, [load]);

  const partnerMap = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);
  const shown = (items ?? []).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));

  const open = (x: Item | null) =>
    setEditing({ id: x?.id ?? null, draft: x ? { ...x } : { ...DEFAULTS[type] } });
  const patch = (k: string, v: unknown) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));

  const save = async () => {
    if (!editing) return;
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = editing.draft[f.key];
      if (f.type === "checkbox") body[f.key] = !!v;
      else if (f.type === "number") body[f.key] = parseInt(String(v ?? ""), 10) || 0;
      else if (f.type === "price" || f.type === "partner")
        body[f.key] = v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      else body[f.key] = v == null ? "" : String(v);
      if (f.required && !String(body[f.key] ?? "").trim()) return push(`${f.label} : obligatoire`, "error");
    }
    const res =
      editing.id == null
        ? await api(`/api/admin/concierge/${type}`, { method: "POST", json: body })
        : await api(`/api/admin/concierge/${type}/${editing.id}`, { method: "PUT", json: body });
    if (res.success) {
      push("Enregistré");
      setEditing(null);
      load();
    } else
      push(
        res.error === "duplicate"
          ? "Ce prestataire existe déjà"
          : res.error?.startsWith("invalid_input")
            ? `Champ invalide : ${res.error.split(": ")[1] ?? ""}`
            : `Erreur : ${res.error}`,
        "error"
      );
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/concierge/${type}/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Supprimé — les séjours qui l'ont déjà demandé le gardent");
      setEditing(null);
      load();
    }
  };

  const input = (f: Field) => {
    const v = editing?.draft[f.key];
    if (f.type === "checkbox")
      return (
        <label key={f.key} className={`flex items-center gap-2 text-sm text-slate-700 ${f.wide ? "sm:col-span-2" : ""}`}>
          <input type="checkbox" checked={!!v} onChange={(e) => patch(f.key, e.target.checked)} />
          {f.label}
        </label>
      );
    return (
      <div key={f.key} className={`afield ${f.wide || f.type === "textarea" ? "sm:col-span-2" : ""}`}>
        <label>
          {f.label}
          {f.type === "price" && " — vide = non proposé"}
        </label>
        {f.type === "textarea" ? (
          <textarea rows={2} value={String(v ?? "")} onChange={(e) => patch(f.key, e.target.value)} />
        ) : f.type === "select" ? (
          <select value={String(v ?? "")} onChange={(e) => patch(f.key, e.target.value)}>
            {f.options!.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        ) : f.type === "partner" ? (
          <select value={v == null ? "" : String(v)} onChange={(e) => patch(f.key, e.target.value)}>
            <option value="">Aucun</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isActive ? "" : " (inactif)"}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={f.type === "number" || f.type === "price" ? "number" : "text"}
            min={f.type === "price" ? 0 : undefined}
            value={v == null ? "" : String(v)}
            onChange={(e) => patch(f.key, e.target.value)}
          />
        )}
      </div>
    );
  };

  const addLabel = { boats: "+ Bateau", "chef-offers": "+ Formule", taxis: "+ Taxi", partners: "+ Prestataire" }[type];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:w-56"
        />
        <span className="text-xs text-slate-500">{items ? `${items.length} au total` : ""}</span>
        <button onClick={() => open(null)} className="abtn-gold ml-auto">
          {addLabel}
        </button>
      </div>

      {!items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">Rien pour l&apos;instant</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((x) => {
            const s = summary(type, x, partnerMap);
            return (
              <button
                key={x.id}
                onClick={() => open(x)}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-navy ${
                  x.isActive && !s.warn ? "border-slate-200" : "border-slate-100 opacity-60"
                }`}
              >
                {typeof x.imageUrl === "string" && x.imageUrl && (
                  <img
                    src={x.imageUrl}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                    {x.name}
                    {!x.isActive && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] text-slate-500">INACTIF</span>
                    )}
                    {s.warn && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] text-amber-700">
                        {s.warn.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">{s.sub}</div>
                </div>
                {s.right && <div className="shrink-0 text-right text-sm text-gold-dark">{s.right}</div>}
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id == null ? addLabel.replace("+ ", "Nouveau : ") : String(editing.draft.name ?? "")}
        wide
      >
        {editing && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">{fields.map(input)}</div>
            <div className="mt-4 flex items-center justify-between">
              {editing.id != null ? (
                <ConfirmButton className="text-xs text-red-500 hover:underline" onConfirm={() => remove(editing.id!)}>
                  Supprimer
                </ConfirmButton>
              ) : (
                <span />
              )}
              <button onClick={save} className="abtn-primary">
                Enregistrer
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
