"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Card, ConfirmButton, fmtUSD, Modal, Spinner, useToast } from "./ui";

interface ClientRow {
  id: number;
  firstname: string;
  lastname: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string;
  notes: string | null;
  discountPercent: number;
  discountReason: string | null;
  isVip: boolean;
  blacklisted: boolean;
  blacklistReason: string | null;
  tags: string | null;
  source: string;
  stats: { stays: number; nights: number; spent: number; reservations: number };
  loyalty: { points: number; lifetimePoints: number } | null;
}

const EMPTY_FORM = {
  firstname: "",
  lastname: "",
  email: "",
  phone: "",
  country: "",
  language: "en",
  notes: "",
  discountPercent: 0,
  discountReason: "",
  isVip: false,
  blacklisted: false,
  blacklistReason: "",
  tags: "",
};

export function ClientsCrm({ loyaltyEnabled = false }: { loyaltyEnabled?: boolean }) {
  const { push } = useToast();
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(() => {
    api<{ clients: ClientRow[] }>("/api/admin/clients").then(
      (d) => d.success && setClients(d.clients)
    );
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!clients) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) =>
      `${c.firstname} ${c.lastname} ${c.email ?? ""} ${c.tags ?? ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [clients, q]);

  const openEdit = (c: ClientRow | null) => {
    if (c) {
      setEditing(c);
      setForm({
        firstname: c.firstname,
        lastname: c.lastname,
        email: c.email ?? "",
        phone: c.phone ?? "",
        country: c.country ?? "",
        language: c.language,
        notes: c.notes ?? "",
        discountPercent: c.discountPercent,
        discountReason: c.discountReason ?? "",
        isVip: c.isVip,
        blacklisted: c.blacklisted,
        blacklistReason: c.blacklistReason ?? "",
        tags: c.tags ?? "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setCreating(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      country: form.country || null,
      notes: form.notes || null,
      discountReason: form.discountReason || null,
      blacklistReason: form.blacklistReason || null,
      tags: form.tags || null,
    };
    const res = editing
      ? await api(`/api/admin/clients/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/clients", { method: "POST", json: payload });
    if (res.success) {
      push("Client enregistré");
      setCreating(false);
      load();
    } else {
      push(res.error === "email_exists" ? "Cet email existe déjà" : `Erreur : ${res.error}`, "error");
    }
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Client supprimé");
      setCreating(false);
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">
          Clients {clients && <span className="text-sm font-normal text-slate-400">({clients.length})</span>}
        </h1>
        <div className="flex gap-2">
          <input
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-52"
          />
          <button onClick={() => openEdit(null)} className="abtn-gold">
            + Client
          </button>
        </div>
      </div>

      <Card>
        {!filtered ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun client</p>
        ) : (
          <>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="flex w-full min-h-[64px] items-start justify-between gap-3 py-3 text-left active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">
                      {c.isVip && "⭐ "}
                      {c.blacklisted && "⛔ "}
                      {c.firstname} {c.lastname}
                      {c.country && <span className="ml-1.5 text-xs font-normal text-slate-400">{c.country}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-500">{c.email}</div>
                    {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
                    {c.tags && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.split(",").map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.7rem] text-slate-500">
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="font-semibold text-slate-800">{fmtUSD(c.stats.spent)}</div>
                    <div className="text-xs text-slate-400">
                      {c.stats.stays} séjour{c.stats.stays > 1 ? "s" : ""}
                    </div>
                    {c.discountPercent > 0 && <div className="text-xs text-emerald-600">-{c.discountPercent}%</div>}
                    {loyaltyEnabled && <div className="text-xs text-gold-dark">✦ {c.loyalty?.points ?? 0}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Client</th>
                  <th className="pb-2.5 pr-3 font-medium">Contact</th>
                  <th className="pb-2.5 pr-3 font-medium">Pays</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Séjours</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Total dépensé</th>
                  {loyaltyEnabled && (
                    <th className="pb-2.5 pr-3 text-right font-medium">✦ Points</th>
                  )}
                  <th className="pb-2.5 font-medium">Badges</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openEdit(c)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 pr-3 font-semibold text-slate-800">
                      {c.firstname} {c.lastname}
                      {c.tags && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.tags.split(",").map((t) => (
                            <span
                              key={t}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-normal text-slate-500"
                            >
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">
                      {c.email}
                      {c.phone && <div className="text-xs">{c.phone}</div>}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{c.country ?? "—"}</td>
                    <td className="py-3 pr-3 text-center">{c.stats.stays}</td>
                    <td className="py-3 pr-3 text-right font-medium">{fmtUSD(c.stats.spent)}</td>
                    {loyaltyEnabled && (
                      <td className="py-3 pr-3 text-right text-gold-dark">
                        {c.loyalty?.points ?? 0}
                      </td>
                    )}
                    <td className="py-3">
                      {c.isVip && "⭐ "}
                      {c.blacklisted && "⛔ "}
                      {c.discountPercent > 0 && (
                        <span className="text-xs text-emerald-600">-{c.discountPercent}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={editing ? `${editing.firstname} ${editing.lastname}` : "Nouveau client"}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="afield">
            <label>Prénom *</label>
            <input value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} />
          </div>
          <div className="afield">
            <label>Nom *</label>
            <input value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} />
          </div>
          <div className="afield">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="afield">
            <label>Téléphone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="afield">
            <label>Pays</label>
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="afield">
            <label>Langue</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="ru">Русский</option>
            </select>
          </div>
          <div className="afield">
            <label>Remise permanente (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.discountPercent || ""}
              onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="afield">
            <label>Raison de la remise</label>
            <input value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} />
          </div>
          <div className="afield sm:col-span-2">
            <label>Tags (séparés par des virgules)</label>
            <input
              value={form.tags}
              placeholder="famille, repeat, presse…"
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <div className="afield sm:col-span-2">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVip}
              onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
              className="accent-gold"
            />
            ⭐ Client VIP
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.blacklisted}
              onChange={(e) => setForm({ ...form, blacklisted: e.target.checked })}
              className="accent-red-600"
            />
            ⛔ Liste noire
          </label>
          {form.blacklisted && (
            <div className="afield sm:col-span-2">
              <label>Raison liste noire</label>
              <input
                value={form.blacklistReason}
                onChange={(e) => setForm({ ...form, blacklistReason: e.target.value })}
              />
            </div>
          )}
        </div>

        {editing && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
            <span>
              {editing.stats.stays} séjours confirmés · {editing.stats.nights} nuits ·{" "}
              {fmtUSD(editing.stats.spent)}
              {loyaltyEnabled && ` · ✦ ${editing.loyalty?.points ?? 0} points`}
            </span>
            <ConfirmButton
              className="text-xs text-red-500 hover:underline"
              onConfirm={() => remove(editing.id)}
              confirmLabel="Confirmer la suppression ?"
            >
              Supprimer
            </ConfirmButton>
          </div>
        )}

        <button onClick={save} className="abtn-primary mt-4 w-full">
          Enregistrer
        </button>
      </Modal>
    </div>
  );
}
