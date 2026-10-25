"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, Spinner, useToast } from "./ui";

type Bi = { en: string; fr: string };
interface Section {
  h: string;
  p: string[];
  places?: string[];
  flightSearch?: boolean;
}
interface Guide {
  id: number;
  slug: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  published: string;
  updated: string;
  title: Bi;
  description: Bi;
  meta: { title: Bi; description: Bi };
  sections: { en: Section[]; fr: Section[] };
  links: Array<{ label: Bi; url: string }>;
}

const CATEGORIES: Record<string, string> = { practical: "Pratique", island: "L'île" };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_BI: Bi = { en: "", fr: "" };

function blankGuide(sortOrder: number): Omit<Guide, "id"> {
  return {
    slug: "",
    category: "island",
    sortOrder,
    isPublished: false,
    published: today(),
    updated: today(),
    title: { ...EMPTY_BI },
    description: { ...EMPTY_BI },
    meta: { title: { ...EMPTY_BI }, description: { ...EMPTY_BI } },
    sections: { en: [], fr: [] },
    links: [],
  };
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function BiField({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: Bi;
  onChange: (v: Bi) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["fr", "en"] as const).map((l) => (
        <div key={l} className="afield">
          <label>
            {label} ({l.toUpperCase()}){hint ? <span className="ml-1 text-slate-400">{hint}</span> : null}
          </label>
          {rows ? (
            <textarea rows={rows} value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          ) : (
            <input value={value[l]} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          )}
        </div>
      ))}
    </div>
  );
}

/** One language's sections: heading, paragraphs (a blank line between two), map pins. */
function SectionsEditor({ lang, sections, onChange }: { lang: "en" | "fr"; sections: Section[]; onChange: (s: Section[]) => void }) {
  const set = (i: number, s: Section) => onChange(sections.map((x, j) => (j === i ? s : x)));
  const move = (from: number, to: number) => {
    const next = [...sections];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div className="min-w-0 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{lang === "fr" ? "Français" : "English"}</div>
      {sections.map((s, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-start gap-2">
            <div className="afield flex-1">
              <label>Titre de la section</label>
              <input value={s.h} onChange={(e) => set(i, { ...s, h: e.target.value })} />
            </div>
            <div className="flex gap-1 pt-6 text-slate-400">
              <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-30">
                ↑
              </button>
              <button
                type="button"
                disabled={i === sections.length - 1}
                onClick={() => move(i, i + 1)}
                className="rounded px-1.5 hover:bg-slate-100 disabled:opacity-30"
              >
                ↓
              </button>
              <ConfirmButton className="rounded px-1.5 hover:bg-red-50 hover:text-red-600" confirmLabel="Supprimer ?" onConfirm={() => onChange(sections.filter((_, j) => j !== i))}>
                ✕
              </ConfirmButton>
            </div>
          </div>
          <div className="afield">
            <label>Paragraphes (une ligne vide entre deux paragraphes)</label>
            <textarea
              rows={Math.min(14, Math.max(4, s.p.join("\n\n").length / 80))}
              value={s.p.join("\n\n")}
              onChange={(e) => set(i, { ...s, p: e.target.value.split(/\n\s*\n/) })}
            />
          </div>
          <div className="afield">
            <label>Lieux de la carte (séparés par des virgules)</label>
            <input
              value={(s.places ?? []).join(", ")}
              placeholder="ex. lorient, saline"
              onChange={(e) => {
                const places = e.target.value.split(",").map((x) => x.trim());
                set(i, { ...s, places: places.some(Boolean) ? places : undefined });
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={!!s.flightSearch} onChange={(e) => set(i, { ...s, flightSearch: e.target.checked || undefined })} />
            Afficher la recherche de vols après cette section
          </label>
        </div>
      ))}
      <button type="button" className="abtn-ghost !py-1 text-xs" onClick={() => onChange([...sections, { h: "", p: [""] }])}>
        + Section
      </button>
    </div>
  );
}

function GuideEditor({ guide, onClose, onSaved }: { guide: Guide | (Omit<Guide, "id"> & { id?: undefined }); onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [g, setG] = useState(guide);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const clean = (list: Section[]) =>
      list.map((s) => ({
        ...s,
        p: s.p.map((x) => x.trim()).filter(Boolean),
        places: s.places?.map((x) => x.trim()).filter(Boolean),
      }));
    const payload = {
      slug: g.slug,
      category: g.category,
      sortOrder: g.sortOrder,
      isPublished: g.isPublished,
      publishedOn: g.published,
      updatedOn: g.updated,
      title: g.title,
      description: g.description,
      metaTitle: g.meta.title,
      metaDescription: g.meta.description,
      sections: { en: clean(g.sections.en), fr: clean(g.sections.fr) },
      links: g.links,
    };
    const res = g.id
      ? await api(`/api/admin/guides/${g.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/guides", { method: "POST", json: payload });
    setSaving(false);
    if (res.success) {
      push("Article enregistré — le site est à jour");
      onSaved();
    } else
      push(
        res.error === "slug_taken"
          ? "Cette adresse est déjà utilisée par un autre article"
          : res.error === "invalid_input"
            ? `Champs à vérifier : ${((res as { fields?: string[] }).fields ?? []).join(", ")}`
            : `Erreur : ${res.error}`,
        "error"
      );
  };

  const remove = async () => {
    if (!g.id) return onClose();
    const res = await api(`/api/admin/guides/${g.id}`, { method: "DELETE" });
    if (res.success) {
      push("Article supprimé");
      onSaved();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="abtn-ghost" onClick={onClose}>
          ← Tous les articles
        </button>
        <div className="flex gap-2">
          {g.id && (
            <a className="abtn-ghost" href={`/guide/${guide.slug}`} target="_blank" rel="noreferrer">
              Voir sur le site ↗
            </a>
          )}
          <button className="abtn-gold" disabled={saving} onClick={save}>
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <Card title="Article">
        <div className="space-y-4">
          <BiField label="Titre" value={g.title} onChange={(title) => setG({ ...g, title, slug: g.id || g.slug ? g.slug : slugify(title.en) })} />
          <BiField label="Chapeau" rows={3} value={g.description} onChange={(description) => setG({ ...g, description })} />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="afield sm:col-span-2">
              <label>Adresse (/guide/…)</label>
              <input value={g.slug} onChange={(e) => setG({ ...g, slug: slugify(e.target.value) })} />
            </div>
            <div className="afield">
              <label>Rubrique</label>
              <select value={g.category} onChange={(e) => setG({ ...g, category: e.target.value })}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="afield">
              <label>Publié le</label>
              <input type="date" value={g.published} onChange={(e) => setG({ ...g, published: e.target.value })} />
            </div>
            <div className="afield">
              <label>Mis à jour le</label>
              <input type="date" value={g.updated} onChange={(e) => setG({ ...g, updated: e.target.value })} />
            </div>
            <div className="afield">
              <label>Ordre</label>
              <input type="number" value={g.sortOrder} onChange={(e) => setG({ ...g, sortOrder: parseInt(e.target.value, 10) || 0 })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={g.isPublished} onChange={(e) => setG({ ...g, isPublished: e.target.checked })} />
            En ligne sur le site
          </label>
          <p className="text-xs text-slate-500">
            Changez « Mis à jour le » quand le contenu change vraiment : Google et les IA s&apos;en servent pour juger la fraîcheur de l&apos;article.
          </p>
        </div>
      </Card>

      <Card title="Google (titre et description dans les résultats)">
        <div className="space-y-4">
          <BiField label="Titre" hint="≈ 60 caractères" value={g.meta.title} onChange={(title) => setG({ ...g, meta: { ...g.meta, title } })} />
          <BiField
            label="Description"
            hint="≈ 160 caractères"
            rows={3}
            value={g.meta.description}
            onChange={(description) => setG({ ...g, meta: { ...g.meta, description } })}
          />
        </div>
      </Card>

      <Card title="Sections">
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionsEditor lang="fr" sections={g.sections.fr} onChange={(fr) => setG({ ...g, sections: { ...g.sections, fr } })} />
          <SectionsEditor lang="en" sections={g.sections.en} onChange={(en) => setG({ ...g, sections: { ...g.sections, en } })} />
        </div>
      </Card>

      <Card title="Liens utiles (sources officielles)">
        <div className="space-y-2">
          {g.links.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Libellé FR" value={l.label.fr} onChange={(e) => setG({ ...g, links: g.links.map((x, j) => (j === i ? { ...x, label: { ...x.label, fr: e.target.value } } : x)) })} />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Label EN" value={l.label.en} onChange={(e) => setG({ ...g, links: g.links.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x)) })} />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="https://…" value={l.url} onChange={(e) => setG({ ...g, links: g.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" className="rounded px-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setG({ ...g, links: g.links.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="abtn-ghost !py-1 text-xs" onClick={() => setG({ ...g, links: [...g.links, { label: { ...EMPTY_BI }, url: "" }] })}>
            + Lien
          </button>
        </div>
      </Card>

      <div className="flex justify-between">
        <ConfirmButton onConfirm={remove} confirmLabel="Supprimer l'article ?">
          Supprimer
        </ConfirmButton>
        <button className="abtn-gold" disabled={saving} onClick={save}>
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export function GuidesBoard() {
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [editing, setEditing] = useState<Guide | (Omit<Guide, "id"> & { id?: undefined }) | null>(null);

  const load = useCallback(() => {
    api<{ guides: Guide[] }>("/api/admin/guides").then((d) => d.success && setGuides(d.guides));
  }, []);
  useEffect(load, [load]);

  if (!guides) return <Spinner />;
  if (editing)
    return (
      <GuideEditor
        key={editing.id ?? "new"}
        guide={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Guide St Barth</h1>
          <p className="text-xs text-slate-500">
            Les articles de la page Guide, en français et en anglais. L&apos;introduction et « St Barth en bref » sont dans Textes du site → Guide.
          </p>
        </div>
        <button className="abtn-gold" onClick={() => setEditing(blankGuide((guides.at(-1)?.sortOrder ?? 0) + 10))}>
          + Article
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {guides.map((g) => (
          <button
            key={g.id}
            onClick={() => setEditing(g)}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-navy ${g.isPublished ? "border-slate-200" : "border-slate-100 opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
              {g.title.fr || g.title.en}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-slate-500">{(CATEGORIES[g.category] ?? g.category).toUpperCase()}</span>
              {!g.isPublished && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-amber-700">BROUILLON</span>}
            </div>
            <div className="text-xs text-slate-400">{g.title.en}</div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{g.description.fr || g.description.en}</p>
            <div className="mt-2 text-[0.7rem] text-slate-400">
              /guide/{g.slug} · {g.sections.fr.length} sections · mis à jour le {fmtDate(g.updated)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
