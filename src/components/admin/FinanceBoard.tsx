"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, Card, ConfirmButton, fmtDate, fmtEUR, fmtUSD, Modal, Spinner, useToast } from "./ui";

const CATEGORIES: Record<string, string> = {
  jardinier: "🌿 Jardinier",
  electricite: "⚡ Électricité",
  eau: "💧 Eau",
  menage: "🧹 Ménage",
  piscine: "🏊 Piscine",
  entretien: "🔧 Entretien",
  assurance: "🛡️ Assurance",
  taxe: "📋 Taxe / Impôt",
  internet: "📡 Internet",
  autre: "📦 Autre",
};

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string | null;
  notes: string | null;
  isFixed: boolean;
  frequency: string | null;
  endDate: string | null;
  paymentDay: number;
}

interface Stats {
  months: Array<{
    month: string;
    revenueHT: number;
    net: number;
    commissions: number;
    tax: number;
    expensesEUR: number;
    cashIn: number;
  }>;
  totals: {
    revenueHT: number;
    net: number;
    commissions: number;
    tax: number;
    expensesEUR: number;
    cashIn: number;
  };
}

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  category: "autre",
  amount: "",
  description: "",
  notes: "",
  isFixed: false,
  frequency: "monthly",
  endDate: "",
  paymentDay: 1,
};

export function FinanceBoard() {
  const { push } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [recurring, setRecurring] = useState<Expense[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(() => {
    api<{ expenses: Expense[]; recurring: Expense[] }>(
      `/api/admin/expenses?year=${year}`
    ).then((d) => {
      if (d.success) {
        setExpenses(d.expenses);
        setRecurring(d.recurring);
      }
    });
    api<Stats>(`/api/admin/stats?year=${year}`).then(
      (d) => d.success && setStats(d as unknown as Stats)
    );
  }, [year]);
  useEffect(load, [load]);

  const openModal = (e: Expense | null) => {
    setEditing(e);
    setForm(
      e
        ? {
            date: e.date,
            category: e.category,
            amount: String(e.amount),
            description: e.description ?? "",
            notes: e.notes ?? "",
            isFixed: e.isFixed,
            frequency: e.frequency ?? "monthly",
            endDate: e.endDate ?? "",
            paymentDay: e.paymentDay,
          }
        : EMPTY_FORM
    );
    setModal(true);
  };

  const save = async () => {
    const payload = {
      date: form.date,
      category: form.category,
      amount: parseFloat(form.amount) || 0,
      description: form.description || null,
      notes: form.notes || null,
      isFixed: form.isFixed,
      frequency: form.isFixed ? form.frequency : null,
      endDate: form.isFixed && form.endDate ? form.endDate : null,
      paymentDay: form.paymentDay,
    };
    const res = editing
      ? await api(`/api/admin/expenses/${editing.id}`, { method: "PUT", json: payload })
      : await api("/api/admin/expenses", { method: "POST", json: payload });
    if (res.success) {
      push("Dépense enregistrée");
      setModal(false);
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  const remove = async (id: number) => {
    const res = await api(`/api/admin/expenses/${id}`, { method: "DELETE" });
    if (res.success) {
      push("Dépense supprimée");
      setModal(false);
      load();
    }
  };

  const chartData =
    stats?.months.map((m, i) => ({
      name: MONTH_LABELS[i],
      "Revenu net (USD)": m.net,
      "Dépenses (EUR)": Math.round(m.expensesEUR),
      "Encaissé (USD)": m.cashIn,
    })) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Finances</h1>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button onClick={() => openModal(null)} className="abtn-gold">
            + Dépense
          </button>
        </div>
      </div>

      {/* P&L summary */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Revenu net (année)", value: fmtUSD(stats.totals.net), sub: `dont ${fmtUSD(stats.totals.commissions)} commissions déduites` },
            { label: "Encaissements", value: fmtUSD(stats.totals.cashIn), sub: "paiements reçus (cash)" },
            { label: "Dépenses", value: fmtEUR(stats.totals.expensesEUR), sub: "charges villa (EUR)" },
            { label: "Taxe de séjour collectée", value: fmtUSD(stats.totals.tax), sub: "à reverser (5%)" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</div>
              <div className="mt-1.5 font-display text-2xl text-navy">{k.value}</div>
              <div className="mt-1 text-xs text-slate-400">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      <Card title={`Revenus vs dépenses ${year}`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Revenu net (USD)" fill="#1B4965" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Encaissé (USD)" fill="#C9A962" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Dépenses (EUR)" fill="#dc2626" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recurring */}
        <Card title="🔄 Frais fixes récurrents">
          {recurring.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun frais fixe</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recurring.map((e) => (
                <button
                  key={e.id}
                  onClick={() => openModal(e)}
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <span className="font-medium text-slate-700">
                      {CATEGORIES[e.category]} {e.description && `· ${e.description}`}
                    </span>
                    <div className="text-xs text-slate-400">
                      {{ monthly: "Mensuel", bimonthly: "Bimestriel", quarterly: "Trimestriel", yearly: "Annuel" }[e.frequency ?? "monthly"]}{" "}
                      · le {e.paymentDay} du mois
                      {e.endDate && ` · jusqu'au ${fmtDate(e.endDate)}`}
                    </div>
                  </div>
                  <span className="font-semibold">{fmtEUR(e.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* One-off list */}
        <Card title={`Dépenses ${year}`}>
          {!expenses ? (
            <Spinner />
          ) : expenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucune dépense ponctuelle</p>
          ) : (
            <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {expenses.map((e) => (
                <button
                  key={e.id}
                  onClick={() => openModal(e)}
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <span className="font-medium text-slate-700">
                      {CATEGORIES[e.category]} {e.description && `· ${e.description}`}
                    </span>
                    <div className="text-xs text-slate-400">{fmtDate(e.date)}</div>
                  </div>
                  <span className="font-semibold">{fmtEUR(e.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Expense modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Modifier la dépense" : "Nouvelle dépense"}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="afield">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="afield">
              <label>Catégorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="afield">
            <label>Montant (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Description</label>
            <input
              value={form.description}
              placeholder="Ex : taille des haies, facture EDF…"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.isFixed}
              onChange={(e) => setForm({ ...form, isFixed: e.target.checked })}
              className="accent-navy"
            />
            🔄 Frais fixe récurrent
          </label>
          {form.isFixed && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              <div className="afield">
                <label>Fréquence</label>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="monthly">Mensuel</option>
                  <option value="bimonthly">Bimestriel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>
              <div className="afield">
                <label>Jour de prélèvement</label>
                <select
                  value={form.paymentDay}
                  onChange={(e) => setForm({ ...form, paymentDay: parseInt(e.target.value) })}
                >
                  {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                    <option key={d} value={d}>
                      Le {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="afield col-span-2">
                <label>Jusqu&apos;au (optionnel)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
          )}
          <div className="afield">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            {editing ? (
              <ConfirmButton
                className="text-xs text-red-500 hover:underline"
                onConfirm={() => remove(editing.id)}
              >
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
