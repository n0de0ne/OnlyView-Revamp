"use client";

/**
 * Carte de l'île — the pins of the public map (/map) and their itineraries.
 * A place is a name, a category, a position, and optionally the via-points
 * the drive from the villa must follow (St Barth's lanes fool the router).
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Card, ConfirmButton, Modal, Spinner, useToast } from "./ui";
import {
  CATEGORY_META,
  KIND_META,
  KINDS_BY_CATEGORY,
  MAP_CATEGORIES,
  formatWaypoints,
  parseWaypoints,
  pinStyle,
  type LatLng,
  type MapCategory,
} from "@/components/site/map/map-meta";
import type { EditMode } from "./AdminPlaceMap";

const AdminPlaceMap = dynamic(() => import("./AdminPlaceMap").then((m) => m.AdminPlaceMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-slate-100 sm:h-80" />,
});

interface Place {
  id: number;
  slug: string;
  category: MapCategory;
  kind: string | null;
  name: string;
  zone: string | null;
  lat: number;
  lng: number;
  descriptionEn: string | null;
  descriptionFr: string | null;
  driveMinutes: number | null;
  waypoints: string | null;
  walkFromLastWaypoint: boolean;
  website: string | null;
  phone: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Draft {
  category: MapCategory;
  kind: string;
  name: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  descriptionEn: string;
  descriptionFr: string;
  driveMinutes: string;
  waypoints: LatLng[];
  walkFromLastWaypoint: boolean;
  website: string;
  phone: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyDraft = (category: MapCategory = "restaurant"): Draft => ({
  category,
  kind: "",
  name: "",
  zone: "",
  lat: null,
  lng: null,
  descriptionEn: "",
  descriptionFr: "",
  driveMinutes: "",
  waypoints: [],
  walkFromLastWaypoint: false,
  website: "",
  phone: "",
  sortOrder: "0",
  isActive: true,
});

const toDraft = (p: Place): Draft => ({
  category: p.category,
  kind: p.kind ?? "",
  name: p.name,
  zone: p.zone ?? "",
  lat: p.lat,
  lng: p.lng,
  descriptionEn: p.descriptionEn ?? "",
  descriptionFr: p.descriptionFr ?? "",
  driveMinutes: p.driveMinutes?.toString() ?? "",
  waypoints: parseWaypoints(p.waypoints),
  walkFromLastWaypoint: p.walkFromLastWaypoint,
  website: p.website ?? "",
  phone: p.phone ?? "",
  sortOrder: String(p.sortOrder),
  isActive: p.isActive,
});

export function MapPlacesBoard({ villa }: { villa: LatLng }) {
  const { push } = useToast();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [filter, setFilter] = useState<"all" | MapCategory>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [mode, setMode] = useState<EditMode>("pin");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ places: Place[] }>("/api/admin/map-places").then((d) => d.success && setPlaces(d.places));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c = new Map<MapCategory, number>();
    for (const p of places ?? []) c.set(p.category, (c.get(p.category) ?? 0) + 1);
    return c;
  }, [places]);

  const shown = (places ?? []).filter(
    (p) =>
      (filter === "all" || p.category === filter) &&
      (!q.trim() || `${p.name} ${p.zone ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  const openNew = () => {
    setMode("pin");
    setEditing({ id: null, draft: emptyDraft(filter === "all" ? "restaurant" : filter) });
  };
  const openEdit = (p: Place) => {
    setMode("pin");
    setEditing({ id: p.id, draft: toDraft(p) });
  };
  const patch = (partial: Partial<Draft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...partial } } : e));

  const save = async () => {
    if (!editing) return;
    const d = editing.draft;
    if (!d.name.trim()) return push("Le nom est obligatoire", "error");
    if (d.lat == null || d.lng == null) return push("Placez le repère sur la carte", "error");
    const body = {
      category: d.category,
      kind: d.kind || null,
      name: d.name,
      zone: d.zone || null,
      lat: d.lat,
      lng: d.lng,
      descriptionEn: d.descriptionEn || null,
      descriptionFr: d.descriptionFr || null,
      driveMinutes: d.driveMinutes.trim() === "" ? null : parseInt(d.driveMinutes, 10),
      waypoints: formatWaypoints(d.waypoints),
      walkFromLastWaypoint: d.walkFromLastWaypoint && d.waypoints.length > 0,
      website: d.website.trim() || null,
      phone: d.phone.trim() || null,
      sortOrder: parseInt(d.sortOrder, 10) || 0,
      isActive: d.isActive,
    };
    if (body.driveMinutes != null && !Number.isFinite(body.driveMinutes)) body.driveMinutes = null;
    setSaving(true);
    const res =
      editing.id == null
        ? await api("/api/admin/map-places", { method: "POST", json: body })
        : await api(`/api/admin/map-places/${editing.id}`, { method: "PUT", json: body });
    setSaving(false);
    if (res.success) {
      push(editing.id == null ? "Lieu ajouté" : "Lieu enregistré");
      setEditing(null);
      load();
    } else push(res.error === "invalid_input" ? "Champs invalides (site web complet, coordonnées…)" : `Erreur : ${res.error}`, "error");
  };

  const toggleActive = async (p: Place) => {
    const res = await api(`/api/admin/map-places/${p.id}`, { method: "PUT", json: { isActive: !p.isActive } });
    if (res.success) load();
  };
  const remove = async (p: Place) => {
    const res = await api(`/api/admin/map-places/${p.id}`, { method: "DELETE" });
    if (res.success) {
      push("Lieu supprimé");
      load();
    }
  };

  const kinds = editing ? KINDS_BY_CATEGORY[editing.draft.category] ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Carte de l&apos;île</h1>
          <p className="text-sm text-slate-500">
            Les repères de la carte interactive publique et leurs itinéraires depuis la villa.{" "}
            <a href="/map" target="_blank" rel="noopener" className="text-navy underline">
              Voir la carte ↗
            </a>
          </p>
        </div>
        <button className="abtn-gold" onClick={openNew}>
          + Ajouter un lieu
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...MAP_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              filter === c ? "bg-navy text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {c === "all" ? "Tout" : `${CATEGORY_META[c].emoji} ${CATEGORY_META[c].fr}`}
            <span className="ml-1.5 opacity-60">{c === "all" ? places?.length ?? "…" : counts.get(c) ?? 0}</span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="ml-auto w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:w-56"
        />
      </div>

      {places === null ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="-m-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Lieu</th>
                  <th className="px-4 py-2.5">Catégorie</th>
                  <th className="px-4 py-2.5">Trajet</th>
                  <th className="px-4 py-2.5">Itinéraire</th>
                  <th className="px-4 py-2.5">Visible</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((p) => {
                  const s = pinStyle(p);
                  const wps = parseWaypoints(p.waypoints);
                  return (
                    <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                      <td className="px-4 py-2.5">
                        <button onClick={() => openEdit(p)} className="flex items-center gap-2.5 text-left">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                            style={{ background: s.color }}
                          >
                            {s.emoji}
                          </span>
                          <span>
                            <span className="font-medium text-slate-800">{p.name}</span>
                            {p.zone && <span className="block text-xs text-slate-500">{p.zone}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {CATEGORY_META[p.category]?.fr ?? p.category}
                        {p.kind && p.kind !== "restaurant" && KIND_META[p.kind] && (
                          <span className="block text-xs text-slate-400">{KIND_META[p.kind].fr}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.driveMinutes ? `${p.driveMinutes} min` : "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {wps.length ? (
                          <span title={p.waypoints ?? ""}>
                            {wps.length} point{wps.length > 1 ? "s" : ""}
                            {p.walkFromLastWaypoint ? " · 🚶 à pied" : ""}
                          </span>
                        ) : (
                          <span className="text-slate-300">direct</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {p.isActive ? "Visible" : "Masqué"}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="abtn-ghost !px-2.5 !py-1 text-xs" onClick={() => openEdit(p)}>
                            Modifier
                          </button>
                          <ConfirmButton className="abtn-danger !px-2.5 !py-1 text-xs" onConfirm={() => remove(p)}>
                            Supprimer
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Aucun lieu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id == null ? "Nouveau lieu" : `Modifier — ${editing.draft.name}`}
        wide
      >
        {editing && (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="afield">
                  <label>Catégorie</label>
                  <select
                    value={editing.draft.category}
                    onChange={(e) => patch({ category: e.target.value as MapCategory, kind: "" })}
                  >
                    {MAP_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].emoji} {CATEGORY_META[c].fr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="afield">
                  <label>Type d&apos;icône</label>
                  <select value={editing.draft.kind} onChange={(e) => patch({ kind: e.target.value })} disabled={!kinds.length}>
                    <option value="">Par défaut</option>
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {KIND_META[k].emoji} {KIND_META[k].fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="afield">
                <label>Nom</label>
                <input value={editing.draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="afield">
                  <label>Quartier / zone</label>
                  <input value={editing.draft.zone} onChange={(e) => patch({ zone: e.target.value })} placeholder="Gustavia, Saint-Jean…" />
                </div>
                <div className="afield">
                  <label>Trajet depuis la villa (min)</label>
                  <input type="number" min={0} value={editing.draft.driveMinutes} onChange={(e) => patch({ driveMinutes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="afield">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.draft.lat ?? ""}
                    onChange={(e) => patch({ lat: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="afield">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.draft.lng ?? ""}
                    onChange={(e) => patch({ lng: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="afield">
                <label>Description (EN)</label>
                <textarea rows={2} value={editing.draft.descriptionEn} onChange={(e) => patch({ descriptionEn: e.target.value })} />
              </div>
              <div className="afield">
                <label>Description (FR)</label>
                <textarea rows={2} value={editing.draft.descriptionFr} onChange={(e) => patch({ descriptionFr: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="afield">
                  <label>Site web</label>
                  <input value={editing.draft.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://…" />
                </div>
                <div className="afield">
                  <label>Téléphone</label>
                  <input value={editing.draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="afield">
                  <label>Ordre d&apos;affichage</label>
                  <input type="number" value={editing.draft.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                  <input type="checkbox" checked={editing.draft.isActive} onChange={(e) => patch({ isActive: e.target.checked })} />
                  Visible sur le site
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Clic sur la carte :</span>
                {(
                  [
                    ["pin", "📍 place le repère"],
                    ["via", "🔶 ajoute un point de passage"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      mode === m ? "bg-navy text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <AdminPlaceMap
                villa={villa}
                lat={editing.draft.lat}
                lng={editing.draft.lng}
                category={editing.draft.category}
                kind={editing.draft.kind || null}
                waypoints={editing.draft.waypoints}
                walk={editing.draft.walkFromLastWaypoint}
                mode={mode}
                others={(places ?? []).filter((p) => p.id !== editing.id)}
                onPin={([lat, lng]) => patch({ lat, lng })}
                onWaypoints={(waypoints) => patch({ waypoints })}
              />
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Points de passage ({editing.draft.waypoints.length})
                  </span>
                  {editing.draft.waypoints.length > 0 && (
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => patch({ waypoints: [] })}>
                      Tout effacer
                    </button>
                  )}
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  L&apos;itinéraire depuis la villa passe par ces points, dans l&apos;ordre — pour forcer le bon embranchement
                  quand le routeur choisit une route impossible.
                </p>
                {editing.draft.waypoints.length === 0 && (
                  <p className="text-xs text-slate-400">Aucun : le routeur choisit seul le chemin.</p>
                )}
                <ol className="space-y-1">
                  {editing.draft.waypoints.map((wp, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                        {editing.draft.walkFromLastWaypoint && i === editing.draft.waypoints.length - 1 ? "P" : i + 1}
                      </span>
                      <span className="font-mono">
                        {wp[0].toFixed(5)}, {wp[1].toFixed(5)}
                      </span>
                      <span className="ml-auto flex gap-1">
                        <button
                          type="button"
                          className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          disabled={i === 0}
                          onClick={() => {
                            const w = editing.draft.waypoints.slice();
                            [w[i - 1], w[i]] = [w[i], w[i - 1]];
                            patch({ waypoints: w });
                          }}
                          aria-label="Monter"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          disabled={i === editing.draft.waypoints.length - 1}
                          onClick={() => {
                            const w = editing.draft.waypoints.slice();
                            [w[i + 1], w[i]] = [w[i], w[i + 1]];
                            patch({ waypoints: w });
                          }}
                          aria-label="Descendre"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="rounded px-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => patch({ waypoints: editing.draft.waypoints.filter((_, j) => j !== i) })}
                          aria-label="Retirer"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
                <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={editing.draft.walkFromLastWaypoint}
                    disabled={editing.draft.waypoints.length === 0}
                    onChange={(e) => patch({ walkFromLastWaypoint: e.target.checked })}
                  />
                  <span>
                    🚶 On se gare au dernier point et on finit à pied (Colombier, Anse des Cayes…) — la fin du trajet est
                    tracée en pointillés.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 lg:col-span-2">
              <button className="abtn-ghost" onClick={() => setEditing(null)}>
                Annuler
              </button>
              <button className="abtn-primary" onClick={save} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
