"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  Card,
  fmtDate,
  fmtUSD,
  SEASON_MONTH_LABELS,
  SeasonPicker,
  seasonLabel,
  seasonOfDate,
  Spinner,
  StatusBadge,
} from "./ui";

interface Stats {
  season: number;
  months: Array<{
    month: string;
    revenueHT: number;
    net: number;
    commissions: number;
    occupancy: number;
    expensesEUR: number;
    cashIn: number;
    nightsBooked: number;
  }>;
  totals: {
    revenueHT: number;
    net: number;
    commissions: number;
    tax: number;
    occupancy: number;
    nightsBooked: number;
    reservations: number;
    averageStay: number;
    directShare: number;
    cashIn: number;
    expensesEUR: number;
  };
  sources: Array<{ name: string; count: number; revenue: number }>;
  upcoming: Array<{
    id: number;
    clientName: string | null;
    startDate: string;
    endDate: string;
    guests: number;
    priceTTC: number;
    depositReceived: boolean;
    balanceReceived: boolean;
  }>;
  pendingRequests: number;
  pendingContracts: number;
  expiringOptions: Array<{
    id: number;
    clientName: string | null;
    optionExpires: string | null;
    startDate: string;
  }>;
}

const PIE_COLORS = ["#C9A962", "#1B4965", "#5a8fa8", "#8b5cf6", "#059669", "#f59e0b"];

export function Dashboard() {
  const [season, setSeason] = useState(() => seasonOfDate(new Date()));
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Stats>(`/api/admin/stats?season=${season}`)
      .then((d) => d.success && setStats(d as unknown as Stats))
      .finally(() => setLoading(false));
  }, [season]);

  if (loading && !stats) return <Spinner />;
  if (!stats) return null;

  const chartData = stats.months.map((m, i) => ({
    name: SEASON_MONTH_LABELS[i],
    "Revenu HT": m.revenueHT,
    "Net (après commissions)": m.net,
    "Occupation %": Math.round(m.occupancy * 100),
    Encaissements: m.cashIn,
  }));

  const kpis = [
    { label: `Revenu HT saison`, value: fmtUSD(stats.totals.revenueHT), sub: `${stats.totals.reservations} réservations` },
    { label: "Revenu net", value: fmtUSD(stats.totals.net), sub: `${fmtUSD(stats.totals.commissions)} de commissions` },
    { label: "Occupation", value: `${Math.round(stats.totals.occupancy * 100)}%`, sub: `${stats.totals.nightsBooked} nuits · séjour moyen ${stats.totals.averageStay}n` },
    { label: "Direct", value: `${Math.round(stats.totals.directShare * 100)}%`, sub: "part des réservations en direct" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tableau de bord</h1>
          <p className="text-xs text-slate-400">
            Saison {seasonLabel(season)} · 1ᵉʳ sept. → 31 août
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeasonPicker season={season} onChange={setSeason} />
          <Link href="/admin/reservations/new" className="abtn-gold">
            + Réservation
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(stats.pendingRequests > 0 || stats.expiringOptions.length > 0 || stats.pendingContracts > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.pendingRequests > 0 && (
            <Link
              href="/admin/requests"
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              📥 {stats.pendingRequests} demande{stats.pendingRequests > 1 ? "s" : ""} en attente
            </Link>
          )}
          {stats.pendingContracts > 0 && (
            <Link
              href="/admin/contracts"
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
            >
              ✍️ {stats.pendingContracts} contrat{stats.pendingContracts > 1 ? "s" : ""} à signer
            </Link>
          )}
          {stats.expiringOptions.map((o) => (
            <Link
              key={o.id}
              href={`/admin/reservations/${o.id}`}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              ⏳ Option {o.clientName ?? "—"} expire le {fmtDate(o.optionExpires)}
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {k.label}
            </div>
            <div className="mt-1.5 font-display text-3xl text-navy">{k.value}</div>
            <div className="mt-1 text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <Card title={`Revenus saison ${seasonLabel(season)} (USD)`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A962" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#C9A962" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1B4965" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#1B4965" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              />
              <Tooltip formatter={(v) => fmtUSD(v as number)} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Revenu HT"
                stroke="#C9A962"
                fill="url(#rev)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Net (après commissions)"
                stroke="#1B4965"
                fill="url(#net)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Occupancy */}
        <Card title="Occupation mensuelle" className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="Occupation %" fill="#5a8fa8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sources */}
        <Card title="Sources de réservation">
          {stats.sources.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucune donnée</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.sources}
                    dataKey="revenue"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {stats.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtUSD(v as number)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming arrivals */}
      <Card title="Prochaines arrivées" action={<Link href="/admin/reservations" className="inline-block py-2 text-xs font-medium text-navy hover:underline">Tout voir</Link>}>
        {stats.upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucune arrivée à venir</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.upcoming.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reservations/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {r.clientName ?? "Sans nom"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.guests} pers.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {fmtUSD(r.priceTTC)}
                  </span>
                  <StatusBadge
                    status={r.balanceReceived ? "signed" : r.depositReceived ? "option" : "pending"}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
