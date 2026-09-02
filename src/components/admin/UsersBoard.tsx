"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, Modal, Spinner, useToast } from "./ui";

interface UserRow {
  id: number;
  username: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
}

const ROLES: Record<string, { label: string; desc: string }> = {
  owner: { label: "Propriétaire", desc: "Accès complet : finances, réglages, utilisateurs" },
  manager: { label: "Manager", desc: "Réservations, clients, contrats, contenu" },
  viewer: { label: "Lecture", desc: "Consultation uniquement" },
};

const EMPTY = {
  username: "",
  email: "",
  password: "",
  firstname: "",
  lastname: "",
  role: "manager",
  isActive: true,
};

export function UsersBoard({ currentUserId }: { currentUserId: number }) {
  const { push } = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    api<{ users: UserRow[] }>("/api/admin/users").then((d) => d.success && setUsers(d.users));
  }, []);
  useEffect(load, [load]);

  const openModal = (u: UserRow | null) => {
    setEditing(u);
    setForm(
      u
        ? {
            username: u.username,
            email: u.email,
            password: "",
            firstname: u.firstname ?? "",
            lastname: u.lastname ?? "",
            role: u.role,
            isActive: u.isActive,
          }
        : EMPTY
    );
    setModal(true);
  };

  const save = async () => {
    const payload: Record<string, unknown> = {
      username: form.username,
      email: form.email,
      firstname: form.firstname || null,
      lastname: form.lastname || null,
      role: form.role,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;
    const res = editing
      ? await api(`/api/admin/users/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/users", { method: "POST", json: { ...payload, password: form.password } });
    if (res.success) {
      push("Utilisateur enregistré");
      setModal(false);
      load();
    } else {
      push(
        res.error === "username_or_email_exists"
          ? "Identifiant ou email déjà utilisé"
          : res.error === "cannot_modify_self"
            ? "Impossible de modifier votre propre rôle/statut"
            : `Erreur : ${res.error}`,
        "error"
      );
    }
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Utilisateur supprimé");
      setModal(false);
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Utilisateurs</h1>
        <button onClick={() => openModal(null)} className="abtn-gold">
          + Utilisateur
        </button>
      </div>

      <Card>
        {!users ? (
          <Spinner />
        ) : (
          <>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => openModal(u)}
                  className="flex w-full min-h-[64px] items-start justify-between gap-3 py-3 text-left active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">
                      {u.username}
                      {u.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-slate-400">(vous)</span>}
                      {u.mustChangePassword && <span className="ml-1.5 text-xs text-amber-600">🔑</span>}
                    </div>
                    {(u.firstname || u.lastname) && (
                      <div className="text-xs text-slate-400">{u.firstname} {u.lastname}</div>
                    )}
                    <div className="truncate text-sm text-slate-500">{u.email}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {u.lastLogin ? `connecté ${fmtDate(u.lastLogin.slice(0, 10))}` : "jamais connecté"}
                      {!u.isActive && " · inactif"}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy">
                    {ROLES[u.role]?.label ?? u.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Utilisateur</th>
                  <th className="pb-2.5 pr-3 font-medium">Email</th>
                  <th className="pb-2.5 pr-3 font-medium">Rôle</th>
                  <th className="pb-2.5 pr-3 font-medium">Dernière connexion</th>
                  <th className="pb-2.5 font-medium">Actif</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openModal(u)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-slate-800">{u.username}</span>
                      {u.id === currentUserId && (
                        <span className="ml-1.5 text-xs text-slate-400">(vous)</span>
                      )}
                      {(u.firstname || u.lastname) && (
                        <div className="text-xs text-slate-400">
                          {u.firstname} {u.lastname}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-500">{u.email}</td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
                        {ROLES[u.role]?.label ?? u.role}
                      </span>
                      {u.mustChangePassword && (
                        <span className="ml-1.5 text-xs text-amber-600" title="Doit changer son mot de passe">
                          🔑
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-400">
                      {u.lastLogin ? fmtDate(u.lastLogin.slice(0, 10)) : "jamais"}
                    </td>
                    <td className="py-3">{u.isActive ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? editing.username : "Nouvel utilisateur"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="afield">
              <label>Identifiant *</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="afield">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="afield">
              <label>Prénom</label>
              <input value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} />
            </div>
            <div className="afield">
              <label>Nom</label>
              <input value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} />
            </div>
          </div>
          <div className="afield">
            <label>
              {editing ? "Nouveau mot de passe (vide = inchangé)" : "Mot de passe * (min. 10)"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Rôle</label>
            <select
              value={form.role}
              disabled={editing?.id === currentUserId}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} — {v.desc}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={editing?.id === currentUserId}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-navy"
            />
            Compte actif
          </label>
          <div className="flex items-center justify-between">
            {editing && editing.id !== currentUserId ? (
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
        </div>
      </Modal>
    </div>
  );
}
