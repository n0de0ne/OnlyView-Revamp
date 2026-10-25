"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, Spinner, useToast } from "./ui";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface LocaleValue {
  value: Json;
  original: Json;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Block {
  key: string;
  group: string;
  label: string;
  help?: string;
  shared?: boolean;
  values: Record<string, LocaleValue>;
}

const LOCALE_LABELS: Record<string, string> = { en: "English", fr: "Français", all: "" };

/** Field names a person reads, for the keys the copy uses. */
const FIELD_LABELS: Record<string, string> = {
  label: "Surtitre",
  eyebrow: "Surtitre",
  title: "Titre",
  text: "Texte",
  intro: "Introduction",
  introNoLoyalty: "Introduction (fidélité désactivée)",
  note: "Note",
  noteNoLoyalty: "Note (fidélité désactivée)",
  cta: "Bouton",
  button: "Bouton",
  tagline: "Slogan",
  location: "Lieu",
  discover: "Bouton « découvrir »",
  scroll: "Indication de défilement",
  q: "Question",
  a: "Réponse",
  t: "Titre",
  d: "Texte",
  h: "Titre",
  tag: "Étiquette (facultatif)",
  items: "Éléments",
  rows: "Lignes",
  head: "En-têtes",
  faq: "Questions",
  faqTitle: "Titre des questions",
  name: "Nom",
  alternateNames: "Autres noms (pour Google et les IA)",
  legalOwner: "Propriétaire (société)",
  ownerFirstName: "Prénom de la propriétaire",
  ownerName: "Nom de la propriétaire",
  neighbourhood: "Quartier",
  island: "Île",
  islandShort: "Île (nom court)",
  postalCode: "Code postal",
  country: "Pays (code)",
  bedrooms: "Chambres",
  bathrooms: "Salles de bain",
  guests: "Personnes",
  sizeM2: "Surface (m²)",
  checkin: "Heure d'arrivée",
  checkout: "Heure de départ",
  distances: "Temps de trajet depuis la villa",
  en: "Anglais",
  fr: "Français",
  minutes: "Minutes en voiture",
  key: "Code",
  why: "Pourquoi séjourner — points",
  whyTitle: "Pourquoi séjourner — titre",
  whyIntro: "Pourquoi séjourner — introduction",
  package: "À proximité — points",
  packageLabel: "À proximité — surtitre",
  packageTitle: "À proximité — titre",
  packageIntro: "À proximité — introduction",
  packageOutro: "À proximité — conclusion",
  whats: "Ce qu'il y a — points",
  whatsTitle: "Ce qu'il y a — titre",
  villaTitle: "La villa — titre",
  villaText: "La villa — texte",
  villaCta: "La villa — bouton",
  distancesTitle: "Titre des distances",
  areas: "Quartiers",
  areasTitle: "Quartiers — titre",
  areasIntro: "Quartiers — introduction",
  beachUses: "Quelle plage pour quoi",
  beachesTitle: "Plages — titre",
  beachesByUse: "Quelle plage pour quoi — titre",
  gettingAround: "Se déplacer — titre",
  gettingAroundText: "Se déplacer — texte",
  gettingAroundTips: "Se déplacer — conseils",
  ctaLabel: "Encadré conciergerie — surtitre",
  ctaTitle: "Encadré conciergerie — titre",
  ctaText: "Encadré conciergerie — texte",
  ctaButton: "Encadré conciergerie — bouton",
  exploreLabel: "Explorer — surtitre",
  exploreTitle: "Explorer — titre",
  directoryIntro: "Annuaire — introduction",
  stops: "Étapes de la visite",
  threeD: "Visite 3D",
  bookCta: "Bouton réserver",
  tourCta: "Bouton visite",
  moments: "Moments (heure, nom)",
  facts: "Faits",
  factsTitle: "Faits — titre",
  factsLabel: "Faits — surtitre",
  factsSummary: "Faits — résumé (téléphone)",
  factsToggle: "Faits — bouton détails",
  headingSuffix: "Fin du titre principal (pour Google)",
  categories: "Catégories",
  seasonNames: "Noms des saisons",
  holidayTitle: "Semaines festives — titre",
  holidayNote: "Semaines festives — note",
  specialTitle: "Semaines événement — titre",
  minStay: "Durée minimum",
  tax: "Taxe",
  deposit: "Acompte",
  ownerTitle: "La propriétaire — titre",
  ownerText: "La propriétaire — texte",
  address: "Adresse",
  responseTime: "Délai de réponse",
  languages: "Langues",
  linksTitle: "Titre des liens",
  updated: "« Mis à jour »",
  byline: "Signature",
  pointeMilouCard: "Carte Pointe Milou — titre",
  pointeMilouText: "Carte Pointe Milou — texte",
  siteName: "Nom du site",
  directBadge: "Badge réservation directe",
  verified: "Badge « séjour vérifié »",
  perWeek: "« par semaine »",
  from: "« à partir de »",
  mapCta: "Bouton itinéraire",
  islandMapCta: "Bouton carte de l'île",
  stat_size: "Chiffre 1",
  stat_sunset: "Chiffre 2",
  stat_wifi: "Chiffre 3",
};

const PAGE_NAMES: Record<string, string> = {
  Home: "accueil",
  Villa: "la villa",
  Tour: "visite",
  Gallery: "galerie",
  Rates: "tarifs",
  Booking: "réservation",
  Contact: "contact",
  Faq: "FAQ",
  Reviews: "avis",
  Location: "Pointe Milou",
  Map: "carte",
  Account: "espace client",
  WhyDirect: "réserver en direct",
  Guide: "guide",
};

const isObj = (v: unknown): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

function labelFor(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // page titles and descriptions: titleHome, descWhyDirectNoLoyalty…
  const m = key.match(/^(title|desc)([A-Z]\w*?)(NoLoyalty)?$/);
  if (m && PAGE_NAMES[m[2]])
    return `${m[1] === "title" ? "Titre" : "Description"} — ${PAGE_NAMES[m[2]]}${m[3] ? " (fidélité désactivée)" : ""}`;
  if (key.endsWith("Desc")) return `${labelFor(key.slice(0, -4))} — description`;
  return key.replace(/[-_]/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

/** Same content, whatever order the database returned the fields in. */
const same = (a: Json, b: Json): boolean => stable(a) === stable(b);
function stable(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** An empty value of the same shape, for a new list row. */
function blank(shape: Json): Json {
  if (typeof shape === "string") return "";
  if (typeof shape === "number") return 0;
  if (typeof shape === "boolean") return false;
  if (Array.isArray(shape)) return shape.length && Array.isArray(shape[0]) ? [] : shape.map(blank);
  if (isObj(shape)) return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, blank(v)]));
  return null;
}

/** For a list of objects: every field any item has, with a sample value, and which are optional. */
function itemShape(list: Json[]) {
  const objs = list.filter(isObj);
  const fields = new Map<string, Json>();
  for (const o of objs) for (const [k, v] of Object.entries(o)) if (!fields.has(k)) fields.set(k, v);
  const optional = new Set([...fields.keys()].filter((k) => !objs.every((o) => k in o)));
  return { fields, optional };
}

function Text({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const long = value.length > 80 || value.includes("\n");
  return long ? (
    <textarea rows={Math.min(12, Math.max(2, Math.ceil(value.length / 60) + 1))} value={value} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

function RowTools({ i, n, move, remove }: { i: number; n: number; move: (from: number, to: number) => void; remove: () => void }) {
  return (
    <div className="flex shrink-0 items-start gap-1 pt-0.5 text-slate-400">
      <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label="Monter">
        ↑
      </button>
      <button type="button" disabled={i === n - 1} onClick={() => move(i, i + 1)} className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label="Descendre">
        ↓
      </button>
      <button type="button" onClick={remove} className="rounded px-1.5 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
        ✕
      </button>
    </div>
  );
}

/**
 * Edits any block of copy by following the shape of its original text:
 * texts, numbers, lists (add, reorder, remove), pairs and groups of fields.
 */
function ValueEditor({ value, shape, onChange }: { value: Json; shape: Json; onChange: (v: Json) => void }) {
  if (typeof shape === "string") return <Text value={typeof value === "string" ? value : ""} onChange={onChange} />;
  if (typeof shape === "number")
    return (
      <input
        type="number"
        step="any"
        value={typeof value === "number" ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    );
  if (typeof shape === "boolean")
    return <input type="checkbox" className="!w-auto" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;

  if (Array.isArray(shape)) {
    const list = Array.isArray(value) ? value : [];
    const set = (i: number, v: Json) => onChange(list.map((x, j) => (j === i ? v : x)));
    const move = (from: number, to: number) => {
      const next = [...list];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      onChange(next);
    };
    const remove = (i: number) => onChange(list.filter((_, j) => j !== i));

    // [a, b] pairs: one row of fields each
    if (shape.length && shape.every(Array.isArray)) {
      const row = shape[0] as Json[];
      // short pairs sit on one line; a heading and its paragraph stack
      const inline = (shape as Json[][]).every((r) => r.every((c) => typeof c !== "string" || c.length <= 70));
      return (
        <div className="space-y-2">
          {list.map((item, i) => (
            <div key={i} className={`flex gap-2 ${inline ? "" : "rounded-xl border border-slate-200 bg-slate-50/60 p-3"}`}>
              <div
                className={`grid flex-1 gap-2 ${inline ? "sm:[grid-template-columns:var(--cols)]" : ""}`}
                style={{ ["--cols" as string]: row.map((c, k) => (k === row.length - 1 && typeof c === "string" ? "2fr" : "1fr")).join(" ") }}
              >
                {row.map((cell, k) => (
                  <ValueEditor
                    key={k}
                    shape={cell}
                    value={Array.isArray(item) ? item[k] : null}
                    onChange={(v) => set(i, row.map((_, m) => (m === k ? v : Array.isArray(item) ? item[m] : blank(row[m]))))}
                  />
                ))}
              </div>
              <RowTools i={i} n={list.length} move={move} remove={() => remove(i)} />
            </div>
          ))}
          <button type="button" className="abtn-ghost !py-1 text-xs" onClick={() => onChange([...list, blank(row)])}>
            + Ajouter une ligne
          </button>
        </div>
      );
    }

    // a list of groups of fields (questions, points…)
    if (shape.length && shape.every(isObj)) {
      const { fields, optional } = itemShape(shape);
      return (
        <div className="space-y-3">
          {list.map((item, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex-1 space-y-2">
                {[...fields.entries()].map(([k, sample]) => (
                  <div key={k} className="afield">
                    <label>{labelFor(k)}</label>
                    <ValueEditor
                      shape={sample}
                      value={isObj(item) ? item[k] ?? blank(sample) : blank(sample)}
                      onChange={(v) => {
                        const next = { ...(isObj(item) ? item : {}) };
                        // an optional field left empty is dropped, not saved blank
                        if (optional.has(k) && (v === "" || v === null)) delete next[k];
                        else next[k] = v;
                        set(i, next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <RowTools i={i} n={list.length} move={move} remove={() => remove(i)} />
            </div>
          ))}
          <button
            type="button"
            className="abtn-ghost !py-1 text-xs"
            onClick={() =>
              onChange([...list, Object.fromEntries([...fields.entries()].filter(([k]) => !optional.has(k)).map(([k, v]) => [k, blank(v)]))])
            }
          >
            + Ajouter
          </button>
        </div>
      );
    }

    // a list of texts
    const item = shape[0] ?? "";
    return (
      <div className="space-y-2">
        {list.map((x, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <ValueEditor shape={item} value={x} onChange={(v) => set(i, v)} />
            </div>
            <RowTools i={i} n={list.length} move={move} remove={() => remove(i)} />
          </div>
        ))}
        <button type="button" className="abtn-ghost !py-1 text-xs" onClick={() => onChange([...list, blank(item)])}>
          + Ajouter
        </button>
      </div>
    );
  }

  if (isObj(shape)) {
    const obj = isObj(value) ? value : {};
    return (
      <div className="space-y-3">
        {Object.entries(shape).map(([k, sub]) => {
          const nested = isObj(sub) || (Array.isArray(sub) && (sub.length === 0 || typeof sub[0] !== "string"));
          return (
            <div key={k} className={nested ? "rounded-xl border border-slate-200 p-3" : "afield"}>
              <label className={nested ? "mb-2 block text-xs font-semibold text-slate-600" : undefined}>{labelFor(k)}</label>
              <ValueEditor shape={sub} value={obj[k] ?? blank(sub)} onChange={(v) => onChange({ ...obj, [k]: v })} />
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

function BlockEditor({ block, locale, onSaved }: { block: Block; locale: string; onSaved: () => void }) {
  const { push } = useToast();
  const v = block.values[locale];
  const [draft, setDraft] = useState<Json>(v.value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(v.value), [v.value]);
  const dirty = !same(draft, v.value);
  const isOriginal = same(draft, v.original);

  const save = async () => {
    setSaving(true);
    const res = await api("/api/admin/site-texts", { method: "PUT", json: { key: block.key, locale, value: draft } });
    setSaving(false);
    if (res.success) {
      push("Texte enregistré — le site est à jour");
      onSaved();
    } else push(res.error === "invalid_shape" ? "Un champ est vide ou mal rempli" : `Erreur : ${res.error}`, "error");
  };

  return (
    <div className="min-w-0 space-y-3">
      {LOCALE_LABELS[locale] && <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{LOCALE_LABELS[locale]}</div>}
      <ValueEditor value={draft} shape={v.original} onChange={setDraft} />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button className="abtn-gold" disabled={!dirty || saving} onClick={save}>
          {saving ? "…" : "Enregistrer"}
        </button>
        {dirty && (
          <button className="abtn-ghost" onClick={() => setDraft(v.value)}>
            Annuler
          </button>
        )}
        {!isOriginal && (
          <ConfirmButton className="abtn-ghost" confirmLabel="Remettre le texte d'origine ?" onConfirm={() => setDraft(v.original)}>
            Texte d&apos;origine
          </ConfirmButton>
        )}
        {v.updatedAt && (
          <span className="ml-auto text-[0.7rem] text-slate-400">
            Modifié le {fmtDate(v.updatedAt)}
            {v.updatedBy ? ` par ${v.updatedBy}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function SiteTextsBoard() {
  const [data, setData] = useState<{
    groups: Array<{ id: string; label: string }>;
    blocks: Block[];
    placeholders: Record<string, string>;
  } | null>(null);
  const [group, setGroup] = useState("home");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ groups: Array<{ id: string; label: string }>; blocks: Block[]; placeholders: Record<string, string> }>(
      "/api/admin/site-texts"
    ).then((d) => d.success && setData(d));
  }, []);
  useEffect(load, [load]);

  const blocks = useMemo(() => data?.blocks.filter((b) => b.group === group) ?? [], [data, group]);

  if (!data) return <Spinner />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Textes du site</h1>
        <p className="text-xs text-slate-500">
          Tout le texte des pages publiques, en anglais et en français. Enregistrer met le site à jour tout de suite.
          Les articles du guide se modifient dans « Guide », les photos et les avis dans « Site &amp; contenu ».
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.groups.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGroup(g.id);
              setOpen(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              g.id === group ? "bg-navy text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {blocks.map((b) => {
          const isOpen = open === b.key;
          const edited = Object.values(b.values).some((v) => !same(v.value, v.original));
          return (
            <Card
              key={b.key}
              title={
                <button className="flex items-center gap-2 text-left" onClick={() => setOpen(isOpen ? null : b.key)}>
                  <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
                  {b.label}
                  {edited && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-amber-700">MODIFIÉ</span>}
                </button>
              }
              className={isOpen ? "" : "[&>div:last-child]:hidden"}
            >
              {b.help && <p className="mb-4 text-xs text-slate-500">{b.help}</p>}
              {isOpen && (
                <div className={b.shared ? "" : "grid gap-6 lg:grid-cols-2"}>
                  {Object.keys(b.values).map((locale) => (
                    <BlockEditor key={locale} block={b} locale={locale} onSaved={load} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card title="Valeurs automatiques">
        <p className="mb-3 text-xs text-slate-500">
          Écrites entre accolades dans un texte, elles sont remplacées par la valeur de Réglages : changer l&apos;acompte
          ou la durée minimum met à jour toutes les phrases qui les citent.
        </p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(data.placeholders).map(([k, label]) => (
            <li key={k}>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{`{${k}}`}</code> <span className="text-slate-600">{label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
