"use client";

import { useCallback, useEffect, useState } from "react";
import { tierFor } from "@/lib/loyalty";
import { api, Card, fmtDate, Modal, Spinner, useToast } from "./ui";

interface Account {
  id: number;
  client: { id: number; firstname: string; lastname: string; email: string | null; isVip: boolean };
  points: number;
  lifetimePoints: number;
  recent: Array<{ id: number; kind: string; points: number; reason: string | null; createdAt: string }>;
}

const TIER_STYLE: Record<string, string> = {
  guest: "bg-slate-100 text-slate-600",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-amber-100 text-amber-700",
  platinum: "bg-violet-100 text-violet-700",
};

export function LoyaltyBoard() {
  const { push } = useToast();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [adjust, setAdjust] = useState<Account | null>(null);
  const [form, setForm] = useState({ points: "", reason: "" });

  const load = useCallback(() => {
    api<{ accounts: Account[] }>("/api/admin/loyalty").then(
      (d) => d.success && setAccounts(d.accounts)
    );
  }, []);
  useEffect(load, [load]);

  const submit = async () => {
    if (!adjust) return;
    const points = parseInt(form.points, 10);
    if (!points || !form.reason.trim()) return;
    const res = await api("/api/admin/loyalty", {
      method: "POST",
      json: { clientId: adjust.client.id, points, reason: form.reason.trim() },
    });
    if (res.success) {
      push("Points ajustés");
      setAdjust(null);
      setForm({ points: "", reason: "" });
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">Programme de fidélité</h1>
        <p className="text-xs text-slate-400">
          1 point / 100 $ de loyer payé · 1 point = 1 $ de réduction · paliers 500 / 1500 / 3000
        </p>
      </div>

      <Card>
        {!accounts ? (
          <Spinner />
        ) : accounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Aucun compte fidélité — les points sont attribués automatiquement quand une
            réservation confirmée est payée en totalité.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Client</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Statut</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Points dispo.</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Cumulés</th>
                  <th className="pb-2.5 pr-3 font-medium">Dernière activité</th>
                  <th className="pb-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const tier = tierFor(a.lifetimePoints);
                  return (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3">
                        <span className="font-semibold text-slate-800">
                          {a.client.firstname} {a.client.lastname} {a.client.isVip && "⭐"}
                        </span>
                        <div className="text-xs text-slate-400">{a.client.email}</div>
                      </td>
                      <td className="py-3 pr-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TIER_STYLE[tier]}`}
                        >
                          {tier}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-display text-xl text-gold-dark">
                        {a.points}
                      </td>
                      <td className="py-3 pr-3 text-right text-slate-500">{a.lifetimePoints}</td>
                      <td className="py-3 pr-3 text-xs text-slate-400">
                        {a.recent[0]
                          ? `${a.recent[0].points > 0 ? "+" : ""}${a.recent[0].points} · ${a.recent[0].reason ?? a.recent[0].kind} · ${fmtDate(a.recent[0].createdAt.slice(0, 10))}`
                          : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => setAdjust(a)} className="abtn-ghost !px-2.5 !py-1 text-xs">
                          ± Ajuster
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={adjust != null}
        onClose={() => setAdjust(null)}
        title={`Ajuster les points — ${adjust?.client.firstname} ${adjust?.client.lastname}`}
      >
        <div className="space-y-3">
          <div className="afield">
            <label>Points (négatif pour retirer / utiliser)</label>
            <input
              type="number"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              placeholder="Ex : 250 ou -100"
            />
          </div>
          <div className="afield">
            <label>Raison *</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex : geste commercial, points utilisés séjour #12…"
            />
          </div>
          <button onClick={submit} className="abtn-primary w-full">
            Appliquer
          </button>
          {adjust && adjust.recent.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              {adjust.recent.map((t) => (
                <div key={t.id} className="flex justify-between py-0.5">
                  <span>{t.reason ?? t.kind}</span>
                  <span className={t.points >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {t.points > 0 ? "+" : ""}
                    {t.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
