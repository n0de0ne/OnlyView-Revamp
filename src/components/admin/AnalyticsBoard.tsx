"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
import { api, Card, fmtDate, Spinner, StatusBadge, useToast } from "./ui";
import { AnalyticsVisits } from "./AnalyticsVisits";
import { BOT_CATEGORIES, CHANNELS, countryName, deviceLabel, eventLabel, flag, fmtDuration } from "./analytics-labels";

/* ───────────────────────── types ───────────────────────── */

interface Kpis {
  sessions: number;
  visitors: number;
  newVisitors: number;
  pageviews: number;
  /** null when only old-site visits (time not measured) are in the period */
  avgEngagedSec: number | null;
  bounceRate: number | null;
  pagesPerSession: number;
  conversions: number;
  conversionRate: number;
}

interface Row {
  key: string | null;
  extra?: string | null;
  sessions: number;
  visitors: number;
  avgEngagedSec: number | null;
  bounceRate: number | null;
  conversions: number;
}

type Rec = Record<string, string | number | null>;

interface Report {
  period: { from: string; to: string };
  previous: { from: string; to: string };
  bucket: "day" | "week" | "month";
  kpis: Kpis;
  previousKpis: Kpis;
  series: Rec[];
  pages: Rec[];
  entries: Rec[];
  channels: Row[];
  sources: Row[];
  referrers: Row[];
  referrerUrls: Rec[];
  campaigns: Rec[];
  countries: Row[];
  cities: Row[];
  devices: Row[];
  browsers: Row[];
  oses: Row[];
  languages: Row[];
  siteLocales: Row[];
  hours: Rec[];
  funnel: Array<{ step: string; n: number }>;
  contacted: number;
  events: Rec[];
  outbound: Rec[];
  aiLanding: Rec[];
  newSessions: number;
  returningSessions: number;
}

interface AttributedRequest {
  id: number;
  name: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  status: string;
  reservation: { id: number; status: string; priceTTC: number } | null;
  session: {
    id: string;
    channel: string;
    source: string | null;
    entryPath: string;
    country: string | null;
    city: string | null;
    device: string | null;
    pageviews: number;
    engagedSec: number;
    utmCampaign: string | null;
  } | null;
  visitor: { sessions: number; firstSeenAt: string; firstChannel: string | null; firstSource: string | null } | null;
}

interface Crawlers {
  bots: Rec[];
  daily: Rec[];
  aiPaths: Rec[];
  special: Rec[];
}

interface Live {
  id: string;
  exitPath: string;
  pageviews: number;
  engagedSec: number;
  startedAt: string;
  lastSeenAt: string;
  country: string | null;
  city: string | null;
  device: string | null;
  channel: string;
  source: string | null;
}

export interface Segment {
  channel?: string;
  source?: string;
  country?: string;
  device?: string;
  page?: string;
}

/* ───────────────────────── labels, colours, formatting ───────────────────────── */

const fmtInt = (n: number) => n.toLocaleString("fr-FR");
const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits).replace(".", ",")} %`;
const pageLabel = (p: string | null | undefined) => (p ? (p === "/" ? "/ (accueil)" : p) : "—");

const CHANNEL_ORDER = Object.keys(CHANNELS);

/* ───────────────────────── periods ───────────────────────── */

const localToday = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const PRESETS: Array<{ key: string; label: string; range: () => { from: string; to: string } }> = [
  { key: "today", label: "Aujourd'hui", range: () => ({ from: localToday(), to: localToday() }) },
  { key: "7", label: "7 jours", range: () => ({ from: shift(localToday(), -6), to: localToday() }) },
  { key: "30", label: "30 jours", range: () => ({ from: shift(localToday(), -29), to: localToday() }) },
  { key: "90", label: "90 jours", range: () => ({ from: shift(localToday(), -89), to: localToday() }) },
  { key: "365", label: "12 mois", range: () => ({ from: shift(localToday(), -364), to: localToday() }) },
  {
    key: "season",
    label: "Saison",
    range: () => {
      const t = localToday();
      const y = parseInt(t.slice(0, 4), 10);
      const start = parseInt(t.slice(5, 7), 10) >= 9 ? y : y - 1;
      return { from: `${start}-09-01`, to: t };
    },
  },
];

const TABS = [
  ["overview", "Vue d'ensemble"],
  ["sources", "Sources"],
  ["pages", "Pages"],
  ["geo", "Pays & villes"],
  ["tech", "Appareils"],
  ["conversions", "Réservations"],
  ["visits", "Parcours"],
  ["bots", "Robots & IA"],
] as const;
type Tab = (typeof TABS)[number][0];

/* ───────────────────────── small building blocks ───────────────────────── */

function Delta({ now, before, invert = false, isRate = false }: { now: number; before: number; invert?: boolean; isRate?: boolean }) {
  if (!before && !now) return <span className="text-slate-300">—</span>;
  if (!before) return <span className="text-xs text-slate-400">nouveau</span>;
  const change = isRate ? now - before : (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="text-xs text-slate-400">= stable</span>;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {change > 0 ? "▲" : "▼"} {isRate ? `${Math.abs(change * 100).toFixed(1).replace(".", ",")} pt` : pct(Math.abs(change))}
    </span>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: string; sub?: React.ReactNode; delta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-display text-2xl text-navy sm:text-3xl">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
        {delta}
        {sub}
      </div>
    </div>
  );
}

/** A ranked list with an in-row bar — the workhorse of the breakdowns. */
function RankTable({
  rows,
  label,
  render,
  value = (r) => r.sessions,
  valueLabel = "Visites",
  onPick,
  columns = [],
  empty = "Aucune donnée sur la période",
  limit,
}: {
  rows: Row[];
  label: string;
  render: (r: Row) => React.ReactNode;
  value?: (r: Row) => number;
  valueLabel?: string;
  onPick?: (r: Row) => void;
  columns?: Array<{ label: string; cell: (r: Row) => React.ReactNode; className?: string }>;
  empty?: string;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  const max = Math.max(...rows.map(value), 1);
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-1 pb-2 font-medium">{label}</th>
            <th className="px-1 pb-2 text-right font-medium">{valueLabel}</th>
            {columns.map((c) => (
              <th key={c.label} className={`hidden px-1 pb-2 text-right font-medium sm:table-cell ${c.className ?? ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={`${r.key}-${r.extra ?? ""}-${i}`}
              onClick={onPick ? () => onPick(r) : undefined}
              className={`border-t border-slate-100 ${onPick ? "cursor-pointer hover:bg-slate-50" : ""}`}
              title={onPick ? "Filtrer tout le tableau de bord sur cette valeur" : undefined}
            >
              <td className="relative px-1 py-2">
                <div
                  className="absolute inset-y-1 left-0 rounded bg-navy/[0.07]"
                  style={{ width: `${(value(r) / max) * 100}%` }}
                  aria-hidden
                />
                <div className="relative truncate text-slate-700">{render(r)}</div>
              </td>
              <td className="px-1 py-2 text-right font-semibold tabular-nums text-slate-800">{fmtInt(value(r))}</td>
              {columns.map((c) => (
                <td key={c.label} className={`hidden px-1 py-2 text-right tabular-nums text-slate-500 sm:table-cell ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button onClick={() => setAll(!all)} className="mt-2 px-1 text-xs font-medium text-navy hover:underline">
          {all ? "Réduire" : `Tout afficher (${rows.length})`}
        </button>
      )}
    </div>
  );
}

const STD_COLUMNS: Array<{ label: string; cell: (r: Row) => React.ReactNode }> = [
  { label: "Visiteurs", cell: (r) => fmtInt(r.visitors) },
  { label: "Temps moyen", cell: (r) => (r.avgEngagedSec == null ? "—" : fmtDuration(r.avgEngagedSec)) },
  { label: "Rebond", cell: (r) => (r.bounceRate == null ? "—" : pct(r.bounceRate)) },
  { label: "Demandes", cell: (r) => (r.conversions ? <span className="font-semibold text-emerald-700">{r.conversions}</span> : "—") },
];

function ChannelName({ channel }: { channel: string | null }) {
  const c = CHANNELS[channel ?? "direct"] ?? CHANNELS.direct;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
      {c.label}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

/* ───────────────────────── charts ───────────────────────── */

function TrafficChart({ report }: { report: Report }) {
  const fmtTick = (d: string) => {
    const date = new Date(`${d}T12:00:00Z`);
    return report.bucket === "month"
      ? date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" })
      : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  };
  // every bucket of the period, so quiet days show as zero rather than a gap
  const data = useMemo(() => {
    const by = new Map(report.series.map((r) => [String(r.day), r]));
    const out: Array<Record<string, string | number>> = [];
    if (report.bucket === "day") {
      for (let d = report.period.from; d <= report.period.to; d = shift(d, 1)) {
        const r = by.get(d);
        out.push({ day: d, Visiteurs: Number(r?.visitors ?? 0), "Pages vues": Number(r?.pageviews ?? 0), Demandes: Number(r?.conversions ?? 0) });
      }
      return out;
    }
    return report.series.map((r) => ({
      day: String(r.day),
      Visiteurs: Number(r.visitors),
      "Pages vues": Number(r.pageviews),
      Demandes: Number(r.conversions),
    }));
  }, [report]);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="an-vis" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2a78d6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmtTick} tick={{ fontSize: 11 }} stroke="#94a3b8" minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
          <Tooltip
            labelFormatter={(d) =>
              report.bucket === "day"
                ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
                : `${report.bucket === "week" ? "Semaine du" : "Mois de"} ${fmtTick(String(d))}`
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="Pages vues" stroke="#eb6834" strokeWidth={2} fill="none" dot={false} />
          <Area type="monotone" dataKey="Visiteurs" stroke="#2a78d6" strokeWidth={2} fill="url(#an-vis)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChannelDonut({ rows, onPick }: { rows: Row[]; onPick: (c: string) => void }) {
  const data = CHANNEL_ORDER.map((c) => ({ key: c, name: CHANNELS[c].label, value: rows.find((r) => r.key === c)?.sessions ?? 0 })).filter(
    (d) => d.value > 0
  );
  if (!data.length) return <Empty>Aucune visite sur la période</Empty>;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.key} fill={CHANNELS[d.key].color} onClick={() => onPick(d.key)} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${fmtInt(v as number)} visites (${pct((v as number) / total)})`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.key}>
            <button onClick={() => onPick(d.key)} className="flex w-full items-center justify-between gap-3 rounded px-1 py-0.5 hover:bg-slate-50">
              <ChannelName channel={d.key} />
              <span className="tabular-nums text-slate-500">
                <span className="font-semibold text-slate-800">{fmtInt(d.value)}</span> · {pct(d.value / total)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
function HoursHeatmap({ rows }: { rows: Rec[] }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const r of rows) grid[Number(r.dow) - 1][Number(r.hour)] += Number(r.sessions);
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[10px] text-slate-400">
            {h % 3 === 0 ? `${h}h` : ""}
          </div>
        ))}
        {grid.map((row, d) => (
          <Fragment key={d}>
            <div className="pr-1 text-right text-[11px] leading-5 text-slate-500">
              {DOW[d]}
            </div>
            {row.map((v, h) => (
              <div
                key={`${d}-${h}`}
                className="h-5 rounded-[3px]"
                style={{ background: v ? `rgba(42, 120, 214, ${0.12 + 0.88 * (v / max)})` : "#f1f5f9" }}
                title={`${DOW[d]} ${h}h–${h + 1}h : ${v} visite${v > 1 ? "s" : ""}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Heure de St Barth. Plus la case est foncée, plus il y a de visites.</p>
    </div>
  );
}

function Funnel({ steps }: { steps: Array<{ step: string; n: number }> }) {
  const top = Math.max(steps[0]?.n ?? 0, 1);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].n : 0;
        return (
          <li key={s.step}>
            <div className="mb-0.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-700">
                <span className="mr-1.5 text-xs text-slate-400">{i + 1}.</span>
                {s.step}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold text-slate-800">{fmtInt(s.n)}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {i === 0 ? "" : `${pct(s.n / top, 1)} des visites${prev ? ` · ${pct(s.n / prev)} de l'étape précédente` : ""}`}
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(s.n ? 1.5 : 0, (s.n / top) * 100)}%`, background: i >= steps.length - 2 ? "#008300" : "#2a78d6" }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── live ───────────────────────── */

function LiveBadge() {
  const [live, setLive] = useState<Live[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ live: Live[] }>("/api/admin/analytics/live").then((d) => alive && d.success && setLive(d.live));
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const n = live?.length ?? 0;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="abtn-ghost">
        <span className={`h-2 w-2 rounded-full ${n ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
        {n} en ce moment
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Actifs ces 5 dernières minutes</div>
          {!n ? (
            <p className="py-4 text-center text-sm text-slate-400">Personne sur le site pour l'instant</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {live!.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-700">{pageLabel(s.exitPath)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{s.pageviews} p. · {fmtDuration(s.engagedSec)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {flag(s.country)} {s.city ? `${s.city}, ` : ""}
                    {countryName(s.country)} · {deviceLabel(s.device)} · {CHANNELS[s.channel]?.label ?? s.channel}
                    {s.source ? ` (${s.source})` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── the board ───────────────────────── */

export function AnalyticsBoard() {
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState(() => PRESETS[2].range());
  const [segment, setSegment] = useState<Segment>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<{ report: Report; requests: AttributedRequest[]; crawlers: Crawlers } | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const q = new URLSearchParams({ from: range.from, to: range.to });
    for (const [k, v] of Object.entries(segment)) if (v) q.set(k, v);
    return q.toString();
  }, [range, segment]);

  useEffect(() => {
    setLoading(true);
    api<{ report: Report; requests: AttributedRequest[]; crawlers: Crawlers }>(`/api/admin/analytics?${query}`)
      .then((d) => d.success && setData({ report: d.report, requests: d.requests, crawlers: d.crawlers }))
      .finally(() => setLoading(false));
  }, [query]);

  const pick = useCallback((k: keyof Segment, v: string | null | undefined) => {
    setSegment((s) => ({ ...s, [k]: v ?? "??" }));
  }, []);

  if (!data) return loading ? <Spinner /> : <Empty>Impossible de charger les statistiques.</Empty>;
  const { report: r, requests, crawlers } = data;
  const k = r.kpis;
  const pk = r.previousKpis;
  const segmentChips = Object.entries(segment).filter(([, v]) => v) as Array<[keyof Segment, string]>;
  const chipLabel = (key: keyof Segment, v: string) =>
    key === "channel"
      ? CHANNELS[v]?.label ?? v
      : key === "country"
        ? `${flag(v)} ${countryName(v)}`
        : key === "device"
          ? deviceLabel(v)
          : key === "page"
            ? `Page ${pageLabel(v)}`
            : v;
  const aiRows = r.sources.filter((s) => s.extra === "ai");
  const searchRows = r.sources.filter((s) => s.extra === "search");
  const agencyRows = r.sources.filter((s) => s.extra === "agency");
  const aiSessions = r.channels.find((c) => c.key === "ai")?.sessions ?? 0;
  const attributed = requests.filter((q) => q.session);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analytique</h1>
          <p className="text-xs text-slate-400">
            Visiteurs du site public · {fmtDate(r.period.from)} → {fmtDate(r.period.to)} · comparé au {fmtDate(r.previous.from)} →{" "}
            {fmtDate(r.previous.to)}
            {loading && " · mise à jour…"}
          </p>
        </div>
        <LiveBadge />
      </div>

      {/* period + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg border border-slate-300 bg-white p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key);
                setRange(p.range());
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                preset === p.key ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="afield flex items-center gap-1.5">
          <input
            type="date"
            aria-label="Du"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, from: e.target.value });
            }}
            className="!w-auto !py-1.5"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            aria-label="Au"
            value={range.to}
            min={range.from}
            onChange={(e) => {
              setPreset("custom");
              setRange({ ...range, to: e.target.value });
            }}
            className="!w-auto !py-1.5"
          />
        </div>
        {segmentChips.map(([key, v]) => (
          <button
            key={key}
            onClick={() => setSegment((s) => ({ ...s, [key]: undefined }))}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/30 bg-navy/5 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/10"
            title="Retirer ce filtre"
          >
            {chipLabel(key, v)} <span aria-hidden>✕</span>
          </button>
        ))}
        {segmentChips.length > 1 && (
          <button onClick={() => setSegment({})} className="text-xs text-slate-500 hover:underline">
            Tout retirer
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Visiteurs"
          value={fmtInt(k.visitors)}
          delta={<Delta now={k.visitors} before={pk.visitors} />}
          sub={`${fmtInt(k.newVisitors)} nouveaux`}
        />
        <Kpi label="Visites" value={fmtInt(k.sessions)} delta={<Delta now={k.sessions} before={pk.sessions} />} />
        <Kpi
          label="Pages vues"
          value={fmtInt(k.pageviews)}
          delta={<Delta now={k.pageviews} before={pk.pageviews} />}
          sub={`${k.pagesPerSession.toFixed(1).replace(".", ",")} / visite`}
        />
        <Kpi
          label="Temps moyen"
          value={k.avgEngagedSec == null ? "—" : fmtDuration(k.avgEngagedSec)}
          delta={k.avgEngagedSec != null && <Delta now={k.avgEngagedSec} before={pk.avgEngagedSec ?? 0} />}
          sub={k.avgEngagedSec == null ? "non mesuré par l'ancien site" : "par visite"}
        />
        <Kpi
          label="Rebond"
          value={k.bounceRate == null ? "—" : pct(k.bounceRate)}
          delta={k.bounceRate != null && <Delta now={k.bounceRate} before={pk.bounceRate ?? 0} invert isRate />}
          sub={k.bounceRate == null ? "non mesuré par l'ancien site" : "1 page, moins de 10 s"}
        />
        <Kpi
          label="Demandes de résa"
          value={fmtInt(k.conversions)}
          delta={<Delta now={k.conversions} before={pk.conversions} />}
          sub={`${pct(k.conversionRate, 1)} des visites`}
        />
      </div>

      {/* tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === key ? "border-navy text-navy" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <Card title="Fréquentation">
            <TrafficChart report={r} />
          </Card>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="D'où viennent les visiteurs" action={<button onClick={() => setTab("sources")} className="text-xs font-medium text-navy hover:underline">Détail</button>}>
              <ChannelDonut rows={r.channels} onPick={(c) => pick("channel", c)} />
              {aiSessions > 0 && (
                <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                  ✨ {fmtInt(aiSessions)} visite{aiSessions > 1 ? "s" : ""} envoyée{aiSessions > 1 ? "s" : ""} par des assistants IA (
                  {aiRows.map((a) => `${a.key} ${a.sessions}`).join(", ")}).
                </p>
              )}
            </Card>
            <Card title="Parcours de réservation" action={<button onClick={() => setTab("conversions")} className="text-xs font-medium text-navy hover:underline">Détail</button>}>
              <Funnel steps={r.funnel} />
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Pages les plus vues">
              <RankTable
                rows={r.pages.map((p) => ({ key: String(p.path), sessions: Number(p.views), visitors: Number(p.visitors), avgEngagedSec: Number(p.avgEngaged), bounceRate: 0, conversions: 0 }))}
                label="Page"
                valueLabel="Vues"
                render={(x) => pageLabel(x.key)}
                onPick={(x) => pick("page", x.key)}
                columns={[{ label: "Temps moyen", cell: (x) => (x.avgEngagedSec ? fmtDuration(x.avgEngagedSec) : "—") }]}
                limit={8}
              />
            </Card>
            <Card title="Pays">
              <RankTable
                rows={r.countries}
                label="Pays"
                render={(x) => `${flag(x.key)} ${countryName(x.key)}`}
                onPick={(x) => pick("country", x.key)}
                columns={[STD_COLUMNS[0], STD_COLUMNS[3]]}
                limit={8}
              />
            </Card>
          </div>
          <Card title="Quand viennent-ils ?">
            <HoursHeatmap rows={r.hours} />
          </Card>
        </div>
      )}

      {tab === "sources" && (
        <div className="space-y-5">
          <Card title="Canaux">
            <RankTable rows={r.channels} label="Canal" render={(x) => <ChannelName channel={x.key} />} onPick={(x) => pick("channel", x.key)} columns={STD_COLUMNS} />
          </Card>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="✨ Assistants IA (ChatGPT, Perplexity, Gemini, Copilot, Claude…)">
              <RankTable
                rows={aiRows}
                label="Assistant"
                render={(x) => x.key}
                onPick={(x) => pick("source", x.key)}
                columns={STD_COLUMNS.slice(1)}
                empty="Aucune visite venue d'un assistant IA sur la période"
              />
              {r.aiLanding.length > 0 && (
                <>
                  <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Pages où ils arrivent</div>
                  <ul className="space-y-1 text-sm">
                    {r.aiLanding.map((a, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate text-slate-700">
                          {pageLabel(String(a.path))} <span className="text-xs text-slate-400">via {a.source}</span>
                        </span>
                        <span className="tabular-nums text-slate-500">{a.sessions}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
            <Card title="🔎 Moteurs de recherche">
              <RankTable
                rows={searchRows}
                label="Moteur"
                render={(x) => x.key}
                onPick={(x) => pick("source", x.key)}
                columns={STD_COLUMNS.slice(1)}
                empty="Aucune visite venue d'un moteur de recherche sur la période"
              />
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Google et Bing ne transmettent plus les mots-clés tapés : ils sont visibles dans Google Search Console et Bing Webmaster Tools
                (codes de vérification dans Réglages → Contact &amp; villa).
              </p>
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="🤝 Agences & annonces">
              <RankTable
                rows={agencyRows}
                label="Site"
                render={(x) => x.key}
                onPick={(x) => pick("source", x.key)}
                columns={STD_COLUMNS.slice(1)}
                empty="Aucune visite venue d'une agence sur la période"
              />
            </Card>
            <Card title="Toutes les sources">
              <RankTable
                rows={r.sources}
                label="Source"
                render={(x) => (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHANNELS[x.extra ?? "direct"]?.color }} aria-hidden />
                    {x.key}
                  </span>
                )}
                onPick={(x) => (x.key === "(direct)" ? pick("channel", "direct") : pick("source", x.key))}
                columns={[STD_COLUMNS[3]]}
                limit={12}
              />
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Pages qui envoient des visiteurs (référents)">
              {r.referrerUrls.length === 0 ? (
                <Empty>Aucun lien entrant sur la période</Empty>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.referrerUrls.map((u, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                      <a href={String(u.url)} target="_blank" rel="noreferrer noopener" className="truncate text-navy hover:underline">
                        {String(u.url).replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                      <span className="shrink-0 tabular-nums text-slate-500">{u.sessions}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Campagnes (liens utm_…)">
              {r.campaigns.length === 0 ? (
                <Empty>
                  Aucune campagne. Ajoutez <code className="rounded bg-slate-100 px-1">?utm_source=instagram&amp;utm_campaign=noel</code> à vos
                  liens (bio Instagram, newsletters, annonces) pour les suivre ici.
                </Empty>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-medium">Campagne</th>
                      <th className="pb-2 font-medium">Source / support</th>
                      <th className="pb-2 text-right font-medium">Visites</th>
                      <th className="pb-2 text-right font-medium">Demandes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.campaigns.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-700">{c.campaign ?? "—"}</td>
                        <td className="py-1.5 text-slate-500">
                          {c.source ?? "—"} / {c.medium ?? "—"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{c.sessions}</td>
                        <td className="py-1.5 text-right tabular-nums">{Number(c.conversions) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-5">
          <Card title="Toutes les pages">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-1 pb-2 font-medium">Page</th>
                    <th className="px-1 pb-2 text-right font-medium">Vues</th>
                    <th className="px-1 pb-2 text-right font-medium">Visiteurs</th>
                    <th className="px-1 pb-2 text-right font-medium">Temps moyen</th>
                    <th className="px-1 pb-2 text-right font-medium">Lu jusqu'à</th>
                    <th className="px-1 pb-2 text-right font-medium">En français</th>
                  </tr>
                </thead>
                <tbody>
                  {r.pages.map((p) => (
                    <tr key={String(p.path)} onClick={() => pick("page", String(p.path))} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-1 py-2 text-slate-700">{pageLabel(String(p.path))}</td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">{fmtInt(Number(p.views))}</td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-500">{fmtInt(Number(p.visitors))}</td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-500">{Number(p.avgEngaged) ? fmtDuration(Number(p.avgEngaged)) : "—"}</td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-500">{Number(p.avgScroll) ? `${p.avgScroll} %` : "—"}</td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-500">{Number(p.views) ? pct(Number(p.fr) / Number(p.views)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!r.pages.length && <Empty>Aucune page vue sur la période</Empty>}
            </div>
          </Card>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Pages d'arrivée (première page vue)">
              <RankTable
                rows={r.entries.map((e) => ({ key: String(e.path), sessions: Number(e.sessions), visitors: 0, avgEngagedSec: 0, bounceRate: Number(e.measured) ? Number(e.bounces) / Number(e.measured) : null, conversions: Number(e.conversions) }))}
                label="Page"
                render={(x) => pageLabel(x.key)}
                onPick={(x) => pick("page", x.key)}
                columns={[STD_COLUMNS[2], STD_COLUMNS[3]]}
              />
            </Card>
            <Card title="Clics vers d'autres sites">
              {r.outbound.length === 0 ? (
                <Empty>Aucun clic sortant sur la période</Empty>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {r.outbound.map((o, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1.5">
                      <span className="truncate text-slate-700">{o.host ?? "—"}</span>
                      <span className="tabular-nums text-slate-500">{o.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "geo" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Pays">
            <RankTable rows={r.countries} label="Pays" render={(x) => `${flag(x.key)} ${countryName(x.key)}`} onPick={(x) => pick("country", x.key)} columns={STD_COLUMNS} />
          </Card>
          <Card title="Villes">
            <RankTable
              rows={r.cities.filter((c) => c.key)}
              label="Ville"
              render={(x) => `${flag(x.extra)} ${x.key}`}
              onPick={(x) => pick("country", x.extra)}
              columns={[STD_COLUMNS[0], STD_COLUMNS[3]]}
              empty="Aucune ville connue sur la période"
            />
            <p className="mt-3 text-[11px] text-slate-400">
              Localisation approximative (ville du fournisseur d'accès), calculée sur ce serveur. <a href="https://db-ip.com" className="underline" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a>
            </p>
          </Card>
        </div>
      )}

      {tab === "tech" && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Card title="Appareils">
            <RankTable rows={r.devices} label="Appareil" render={(x) => deviceLabel(x.key)} onPick={(x) => pick("device", x.key)} columns={[STD_COLUMNS[3]]} />
          </Card>
          <Card title="Nouveaux / fidèles">
            <RankTable
              rows={[
                { key: "Première visite", sessions: r.newSessions, visitors: 0, avgEngagedSec: 0, bounceRate: 0, conversions: 0 },
                { key: "Revenus sur le site", sessions: r.returningSessions, visitors: 0, avgEngagedSec: 0, bounceRate: 0, conversions: 0 },
              ]}
              label="Visites"
              render={(x) => x.key}
            />
          </Card>
          <Card title="Langue du site">
            <RankTable rows={r.siteLocales} label="Version" render={(x) => (x.key === "fr" ? "🇫🇷 Français" : "🇬🇧 Anglais")} columns={[STD_COLUMNS[3]]} />
          </Card>
          <Card title="Navigateurs">
            <RankTable rows={r.browsers} label="Navigateur" render={(x) => x.key ?? "—"} />
          </Card>
          <Card title="Systèmes">
            <RankTable rows={r.oses} label="Système" render={(x) => x.key ?? "—"} />
          </Card>
          <Card title="Langue de l'appareil">
            <RankTable
              rows={r.languages.filter((l) => l.key)}
              label="Langue"
              render={(x) => {
                try {
                  return new Intl.DisplayNames(["fr"], { type: "language" }).of(String(x.key)) ?? x.key;
                } catch {
                  return x.key;
                }
              }}
            />
          </Card>
        </div>
      )}

      {tab === "conversions" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Parcours de réservation">
              <Funnel steps={r.funnel} />
              <p className="mt-4 text-xs text-slate-500">
                + {fmtInt(r.contacted)} visite{r.contacted > 1 ? "s" : ""} avec une prise de contact (demande, message, WhatsApp, email ou appel).
              </p>
            </Card>
            <Card title="Actions des visiteurs">
              {r.events.length === 0 ? (
                <Empty>Aucune action enregistrée sur la période</Empty>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-medium">Action</th>
                      <th className="pb-2 text-right font-medium">Fois</th>
                      <th className="pb-2 text-right font-medium">Visites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.events.map((e) => (
                      <tr key={String(e.name)} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-700">{eventLabel(String(e.name))}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtInt(Number(e.n))}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-500">{fmtInt(Number(e.sessions))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
          <Card title="Demandes par canal">
            <RankTable
              rows={[...r.channels].filter((c) => c.sessions).sort((a, b) => b.conversions - a.conversions)}
              label="Canal"
              value={(x) => x.conversions}
              valueLabel="Demandes"
              render={(x) => <ChannelName channel={x.key} />}
              onPick={(x) => pick("channel", x.key)}
              columns={[
                { label: "Visites", cell: (x) => fmtInt(x.sessions) },
                { label: "Taux", cell: (x) => (x.sessions ? pct(x.conversions / x.sessions, 1) : "—") },
              ]}
            />
          </Card>
          <Card title={`Demandes de réservation reçues (${requests.length}) — d'où venaient-elles ?`}>
            {requests.length === 0 ? (
              <Empty>Aucune demande sur la période</Empty>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-1 pb-2 font-medium">Reçue</th>
                      <th className="px-1 pb-2 font-medium">Client · séjour</th>
                      <th className="px-1 pb-2 font-medium">Venu par</th>
                      <th className="px-1 pb-2 font-medium">D'où</th>
                      <th className="px-1 pb-2 font-medium">Arrivé sur</th>
                      <th className="px-1 pb-2 text-right font-medium">Visites avant</th>
                      <th className="px-1 pb-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((q) => (
                      <tr key={q.id} className="border-t border-slate-100 align-top">
                        <td className="px-1 py-2 text-slate-500">{fmtDate(q.createdAt)}</td>
                        <td className="px-1 py-2">
                          <Link href="/admin/requests" className="font-medium text-slate-800 hover:underline">
                            {q.name}
                          </Link>
                          <div className="text-xs text-slate-400">
                            {fmtDate(q.startDate)} → {fmtDate(q.endDate)}
                          </div>
                        </td>
                        <td className="px-1 py-2">
                          {q.session ? (
                            <>
                              <ChannelName channel={q.session.channel} />
                              {q.session.source && <div className="text-xs text-slate-400">{q.session.source}{q.session.utmCampaign ? ` · ${q.session.utmCampaign}` : ""}</div>}
                              {q.visitor?.firstChannel && q.visitor.sessions > 1 && (q.visitor.firstSource !== q.session.source || q.visitor.firstChannel !== q.session.channel) && (
                                <div className="text-xs text-slate-400">
                                  1ʳᵉ visite : {CHANNELS[q.visitor.firstChannel]?.label ?? q.visitor.firstChannel}
                                  {q.visitor.firstSource ? ` (${q.visitor.firstSource})` : ""}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">non suivie</span>
                          )}
                        </td>
                        <td className="px-1 py-2 text-slate-600">
                          {q.session ? (
                            <>
                              {flag(q.session.country)} {q.session.city ?? countryName(q.session.country)}
                              <div className="text-xs text-slate-400">{deviceLabel(q.session.device)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-1 py-2 text-slate-600">{q.session ? pageLabel(q.session.entryPath) : "—"}</td>
                        <td className="px-1 py-2 text-right tabular-nums text-slate-600">
                          {q.visitor ? q.visitor.sessions : "—"}
                          {q.visitor && <div className="text-xs text-slate-400">depuis {fmtDate(q.visitor.firstSeenAt)}</div>}
                        </td>
                        <td className="px-1 py-2">
                          {q.reservation ? (
                            <Link href={`/admin/reservations/${q.reservation.id}`}>
                              <StatusBadge status={q.reservation.status} />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500">{q.status === "new" ? "Nouvelle" : q.status === "declined" ? "Refusée" : q.status === "answered" ? "Répondue" : q.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-400">
                  {attributed.length} sur {requests.length} reliée{attributed.length > 1 ? "s" : ""} à une visite (les demandes envoyées avant la mise en place du suivi, ou par un visiteur qui l'a refusé, ne le sont pas).
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "visits" && <AnalyticsVisits query={query} />}

      {tab === "bots" && <CrawlersPanel crawlers={crawlers} />}

      <LegacyImport onDone={() => setRange({ ...range })} />

      <p className="text-[11px] leading-relaxed text-slate-400">
        Mesure d'audience interne : aucun service tiers, adresses IP jamais enregistrées, robots et vos propres visites (connecté à l'admin)
        exclus. Les données détaillées sont effacées après 25 mois. Réglages → Statistiques de visite.
      </p>
    </div>
  );
}

/** One-click import of the old PHP site's visit history (owner only). */
function LegacyImport({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const check = await api<{ summary: { sessions: number; pageviews: number; from: string | null; to: string | null } }>(
      "/api/admin/analytics/import-legacy"
    );
    if (!check.success) {
      setBusy(false);
      push(check.error === "no_legacy_tables" ? "Aucune donnée de l'ancien site dans la base" : "Réservé au propriétaire", "error");
      return;
    }
    const s = check.summary;
    if (
      !window.confirm(
        `Importer ${s.sessions} visites (${s.pageviews} pages vues) de l'ancien site, du ${fmtDate(s.from)} au ${fmtDate(s.to)} ?\nUn import précédent est remplacé ; les visites du nouveau site ne sont pas touchées.`
      )
    ) {
      setBusy(false);
      return;
    }
    const res = await api<{ summary: { sessions: number } }>("/api/admin/analytics/import-legacy", { method: "POST" });
    setBusy(false);
    if (res.success) {
      push(`${res.summary.sessions} visites importées`);
      onDone();
    } else push("Import impossible", "error");
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
      <button onClick={run} disabled={busy} className="abtn-ghost text-xs">
        {busy ? "Import…" : "Importer l'historique de l'ancien site"}
      </button>
      <span className="text-[11px] text-slate-400">Reprend les visites enregistrées par l'ancien site PHP (sans les adresses IP).</span>
    </div>
  );
}

function CrawlersPanel({ crawlers }: { crawlers: Crawlers }) {
  const data = crawlers.daily.map((d) => ({ day: String(d.day), "IA": Number(d.ai), "Moteurs de recherche": Number(d.search), "Autres": Number(d.other) }));
  return (
    <div className="space-y-5">
      <Card title="Passages des robots par jour">
        {data.length === 0 ? (
          <Empty>Aucun robot enregistré sur la période</Empty>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }} maxBarSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  minTickGap={24}
                  tickFormatter={(d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="IA" stackId="a" fill="#6250d6" stroke="#fff" strokeWidth={1} />
                <Bar dataKey="Moteurs de recherche" stackId="a" fill="#2a78d6" stroke="#fff" strokeWidth={1} />
                <Bar dataKey="Autres" stackId="a" fill="#94a3b8" stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card title="Robots qui lisent le site">
        {crawlers.bots.length === 0 ? (
          <Empty>Aucun robot sur la période</Empty>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-1 pb-2 font-medium">Robot</th>
                  <th className="px-1 pb-2 font-medium">Type</th>
                  <th className="px-1 pb-2 text-right font-medium">Pages lues</th>
                  <th className="px-1 pb-2 text-right font-medium">Pages différentes</th>
                  <th className="px-1 pb-2 text-right font-medium">Dernier passage</th>
                </tr>
              </thead>
              <tbody>
                {crawlers.bots.map((b) => (
                  <tr key={String(b.bot)} className="border-t border-slate-100">
                    <td className="px-1 py-1.5">
                      <span className="font-medium text-slate-800">{b.bot}</span> <span className="text-xs text-slate-400">{b.operator}</span>
                    </td>
                    <td className="px-1 py-1.5 text-slate-600">
                      {String(b.category).startsWith("ai_") ? "✨ " : ""}
                      {BOT_CATEGORIES[String(b.category)] ?? b.category}
                    </td>
                    <td className="px-1 py-1.5 text-right font-semibold tabular-nums">{fmtInt(Number(b.hits))}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-slate-500">{fmtInt(Number(b.pages))}</td>
                    <td className="px-1 py-1.5 text-right text-slate-500">{new Date(String(b.lastSeen)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "America/St_Barthelemy" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          « IA — recherche » et « à la demande d'un utilisateur » : ChatGPT, Claude, Perplexity… lisent la page pour répondre à quelqu'un, c'est
          ce qui vous fait citer dans leurs réponses. « Entraînement » : collecte pour les futurs modèles.
        </p>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Pages lues par les IA">
          {crawlers.aiPaths.length === 0 ? (
            <Empty>Aucune page lue par une IA sur la période</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {crawlers.aiPaths.map((p) => (
                <li key={String(p.path)} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-slate-700">{pageLabel(String(p.path))}</span>
                    <span className="block truncate text-xs text-slate-400">{p.names}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{fmtInt(Number(p.hits))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="robots.txt, llms.txt, sitemap.xml — derniers passages">
          {crawlers.special.length === 0 ? (
            <Empty>Pas encore lus</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {crawlers.special.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-slate-700">
                    {p.path} <span className="text-xs text-slate-400">· {p.bot}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(String(p.lastSeen)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "America/St_Barthelemy" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
