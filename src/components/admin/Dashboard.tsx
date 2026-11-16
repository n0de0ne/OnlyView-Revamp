"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, FilePenLine, Hourglass, Inbox, Plus } from "lucide-react";
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
    agencyId: number | null;
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

/** chart colours: the site's gold and deep sea, warm greys for the frame */
const C = { gold: "#C9A962", sea: "#0e2a33", grid: "#ece7dd", axis: "#9f978a" };
const PIE_COLORS = [C.gold, C.sea, "#5b7f8a", "#a8916a", "#776f64", "#d2cabb"];
const AXIS_TICK = { fontSize: 11, fill: "#776f64" };
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e5dfd3", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(26,23,20,.25)" },
  labelStyle: { color: "#1a1714", fontWeight: 500 },
};

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

  // what needs the owner today, most urgent first
  const actions: Array<{ href: string; icon: React.ReactNode; text: string; tone: string }> = [
    ...stats.expiringOptions.map((o) => ({
      href: `/admin/reservations/${o.id}`,
      icon: <Hourglass className="h-4 w-4" strokeWidth={1.5} />,
      text: `Option ${o.clientName ?? "—"} : expire le ${fmtDate(o.optionExpires)}`,
      tone: "bg-amber-50 text-amber-700",
    })),
    ...(stats.pendingRequests > 0
      ? [{
          href: "/admin/requests",
          icon: <Inbox className="h-4 w-4" strokeWidth={1.5} />,
          text: `${stats.pendingRequests} demande${stats.pendingRequests > 1 ? "s" : ""} de réservation en attente`,
          tone: "bg-sky-50 text-sky-700",
        }]
      : []),
    ...(stats.pendingContracts > 0
      ? [{
          href: "/admin/contracts",
          icon: <FilePenLine className="h-4 w-4" strokeWidth={1.5} />,
          text: `${stats.pendingContracts} contrat${stats.pendingContracts > 1 ? "s" : ""} en attente de signature`,
          tone: "bg-violet-50 text-violet-700",
        }]
      : []),
  ];

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-label mb-2 first-letter:uppercase">{today}</p>
          <h1>Tableau de bord</h1>
          <p className="mt-1 text-xs text-slate-500">
            Saison {seasonLabel(season)} · 1ᵉʳ sept. → 31 août
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeasonPicker season={season} onChange={setSeason} />
          <Link href="/admin/reservations/new" className="abtn-gold">
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Réservation
          </Link>
        </div>
      </div>

      {/* Today: what to act on, and who arrives next */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="À traiter" className="xl:col-span-2">
          {actions.length === 0 ? (
            <p className="flex items-center gap-3 py-4 text-sm text-slate-500">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              Rien en attente. Tout est à jour.
            </p>
          ) : (
            <ul className="-my-1 divide-y divide-slate-100">
              {actions.map((a) => (
                <li key={a.href + a.text}>
                  <Link href={a.href} className="group flex items-center gap-3 py-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.tone}`} aria-hidden>
                      {a.icon}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{a.text}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Prochaines arrivées"
          className="xl:col-span-3"
          action={<Link href="/admin/reservations" className="inline-block py-2 text-xs font-medium text-slate-600 hover:text-slate-900">Tout voir</Link>}
        >
          {stats.upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucune arrivée à venir</p>
          ) : (
            <ul className="-my-1 divide-y divide-slate-100">
              {stats.upcoming.map((r) => {
                const d = new Date(r.startDate);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/reservations/${r.id}`} className="group flex flex-wrap items-center gap-4 py-3">
                      {/* the arrival day, as a calendar leaf */}
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-slate-200 bg-slate-50 py-1 leading-none">
                        <span className="font-display text-xl text-slate-800 [font-variant-numeric:lining-nums]">{d.getUTCDate()}</span>
                        <span className="admin-label mt-0.5 !text-[0.55rem]">
                          {d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-slate-900">
                          {r.clientName ?? "Sans nom"}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.guests} pers.
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums text-slate-700">{fmtUSD(r.priceTTC)}</span>
                        {/* every stay here is confirmed: the pill says where its payment stands */}
                        <PaymentBadge
                          agency={r.agencyId != null}
                          depositReceived={r.depositReceived}
                          balanceReceived={r.balanceReceived}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* The season in four figures, as one ruled ledger */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white xl:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={`p-5 md:p-6 ${i % 2 === 1 ? "border-l border-slate-200" : ""} ${i > 1 ? "border-t border-slate-200 xl:border-t-0" : ""} ${i === 2 ? "xl:border-l" : ""}`}
          >
            <div className="admin-label">{k.label}</div>
            <div className="mt-3 font-display text-[2rem] leading-none text-slate-900 [font-variant-numeric:lining-nums] md:text-[2.4rem]">
              {k.value}
            </div>
            <div className="mt-2 text-xs text-slate-500">{k.sub}</div>
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
                  <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.sea} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={C.sea} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} stroke={C.axis} tickLine={false} axisLine={false} />
              <YAxis
                tick={AXIS_TICK}
                stroke={C.axis}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              />
              <Tooltip formatter={(v) => fmtUSD(v as number)} {...TOOLTIP} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Revenu HT" stroke={C.gold} fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="Net (après commissions)" stroke={C.sea} fill="url(#net)" strokeWidth={1.75} />
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
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} stroke={C.axis} tickLine={false} axisLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  stroke={C.axis}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip formatter={(v) => `${v}%`} cursor={{ fill: C.grid, opacity: 0.5 }} {...TOOLTIP} />
                <Bar dataKey="Occupation %" fill={C.sea} radius={[4, 4, 0, 0]} maxBarSize={36} />
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
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="#fff"
                  >
                    {stats.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtUSD(v as number)} {...TOOLTIP} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** An agency pays no deposit: it settles its net once the stay is done. */
function PaymentBadge({
  agency,
  depositReceived,
  balanceReceived,
}: {
  agency: boolean;
  depositReceived: boolean;
  balanceReceived: boolean;
}) {
  const [label, cls] = balanceReceived
    ? ["Soldé", "bg-emerald-50 text-emerald-700 ring-emerald-600/20"]
    : agency
      ? ["Agence · réglé après le séjour", "bg-slate-50 text-slate-600 ring-slate-500/20"]
      : depositReceived
      ? ["Acompte reçu", "bg-sky-50 text-sky-700 ring-sky-600/20"]
      : ["Acompte à recevoir", "bg-amber-50 text-amber-700 ring-amber-600/20"];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
}
