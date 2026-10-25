"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHANNELS, countryName, deviceLabel, eventLabel, flag, fmtDuration } from "./analytics-labels";
import { api, Card, Spinner } from "./ui";

interface Visit {
  id: string;
  visitorId: string;
  isNewVisitor: boolean;
  startedAt: string;
  lastSeenAt: string;
  pageviews: number;
  engagedSec: number;
  entryPath: string;
  referrer: string | null;
  channel: string;
  source: string | null;
  utmCampaign: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  locale: string | null;
  converted: boolean;
  legacy: boolean;
  visitor: { sessions: number; firstSeenAt: string; firstChannel: string | null; firstSource: string | null } | null;
  request: { id: number; name: string; startDate: string; endDate: string; status: string; reservationId: number | null } | null;
  pages: Array<{ path: string; locale: string | null; createdAt: string; engagedSec: number; scrollPct: number }>;
  events: Array<{ name: string; path: string | null; props: string | null; createdAt: string }>;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "America/St_Barthelemy" });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/St_Barthelemy" });

function eventDetail(e: Visit["events"][number]) {
  if (!e.props) return null;
  try {
    const p = JSON.parse(e.props) as Record<string, unknown>;
    if (e.name === "quote_view") return `${p.start ?? ""} · ${p.nights ?? "?"} nuits · ${p.bedrooms ?? "?"} ch.${p.available === false ? " · indisponible" : ""}${p.total ? ` · $${Number(p.total).toLocaleString("fr-FR")}` : ""}`;
    if (e.name === "booking_request") return `${p.start ?? ""} → ${p.end ?? ""} · ${p.guests ?? "?"} pers.`;
    if (e.name === "outbound") return String(p.host ?? "");
    if (p.label) return String(p.label);
  } catch {}
  return null;
}

/** Visit-by-visit: where each one came from and the path it took. */
export function AnalyticsVisits({ query }: { query: string }) {
  const [only, setOnly] = useState<"" | "converted" | "returning">("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; sessions: Visit[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => setPage(0), [query, only]);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams(query);
    if (only) q.set(only, "1");
    q.set("p", String(page));
    api<{ total: number; sessions: Visit[] }>(`/api/admin/analytics/visits?${q}`)
      .then((d) => d.success && setData({ total: d.total, sessions: d.sessions }))
      .finally(() => setLoading(false));
  }, [query, only, page]);

  const pages = data ? Math.ceil(data.total / 30) : 0;

  return (
    <Card
      title={`Parcours des visiteurs${data ? ` (${data.total.toLocaleString("fr-FR")} visites)` : ""}`}
      action={
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs">
          {([
            ["", "Toutes"],
            ["converted", "Avec demande"],
            ["returning", "Visiteurs revenus"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`rounded-md px-2 py-1 font-medium ${only === k ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {!data ? (
        <Spinner />
      ) : data.sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aucune visite ne correspond</p>
      ) : (
        <>
          <ul className={`divide-y divide-slate-100 ${loading ? "opacity-60" : ""}`}>
            {data.sessions.map((s) => {
              const c = CHANNELS[s.channel] ?? CHANNELS.direct;
              const isOpen = open === s.id;
              return (
                <li key={s.id} className="py-2.5">
                  <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full items-start gap-3 text-left">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-slate-800">
                          {flag(s.country)} {s.city ? `${s.city}, ` : ""}
                          {countryName(s.country)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {dateTime(s.startedAt)} · {deviceLabel(s.device)}
                          {s.browser ? ` · ${s.browser}` : ""}
                          {s.locale === "fr" ? " · FR" : ""}
                        </span>
                        {s.converted && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Demande envoyée</span>}
                        {!s.isNewVisitor && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            revenu{s.visitor ? ` · ${s.visitor.sessions} visites` : ""}
                          </span>
                        )}
                        {s.legacy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">ancien site</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {c.label}
                        {s.source ? ` · ${s.source}` : ""}
                        {s.utmCampaign ? ` · campagne ${s.utmCampaign}` : ""} — {s.pageviews} page{s.pageviews > 1 ? "s" : ""} ·{s.legacy ? "" : ` ${fmtDuration(s.engagedSec)} ·`}{" "}
                        {s.pages.map((p) => (p.path === "/" ? "accueil" : p.path.slice(1))).join(" › ")}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 text-xs text-slate-400" aria-hidden>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="ml-5 mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                      {s.referrer && (
                        <div className="text-xs text-slate-500">
                          Arrivé depuis{" "}
                          <a href={s.referrer} target="_blank" rel="noreferrer noopener" className="break-all text-navy underline">
                            {s.referrer}
                          </a>
                        </div>
                      )}
                      {s.visitor && s.visitor.sessions > 1 && (
                        <div className="text-xs text-slate-500">
                          Connu depuis le {new Date(s.visitor.firstSeenAt).toLocaleDateString("fr-FR")} · {s.visitor.sessions} visites · venu la
                          1ʳᵉ fois par {CHANNELS[s.visitor.firstChannel ?? "direct"]?.label ?? s.visitor.firstChannel}
                          {s.visitor.firstSource ? ` (${s.visitor.firstSource})` : ""}
                        </div>
                      )}
                      {s.request && (
                        <div className="text-xs">
                          <Link href="/admin/requests" className="font-medium text-emerald-700 hover:underline">
                            Demande #{s.request.id} — {s.request.name}, {new Date(s.request.startDate).toLocaleDateString("fr-FR", { timeZone: "UTC" })} →{" "}
                            {new Date(s.request.endDate).toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                          </Link>
                          {s.request.reservationId && (
                            <Link href={`/admin/reservations/${s.request.reservationId}`} className="ml-2 text-navy hover:underline">
                              → réservation
                            </Link>
                          )}
                        </div>
                      )}
                      <ol className="space-y-1">
                        {[
                          ...s.pages.map((p) => ({ at: p.createdAt, kind: "page" as const, p })),
                          ...s.events.map((e) => ({ at: e.createdAt, kind: "event" as const, e })),
                        ]
                          .sort((a, b) => a.at.localeCompare(b.at))
                          .map((item, i) =>
                            item.kind === "page" ? (
                              <li key={i} className="flex gap-3">
                                <span className="w-11 shrink-0 tabular-nums text-xs text-slate-400">{time(item.at)}</span>
                                <span className="text-slate-700">
                                  {item.p.path === "/" ? "Accueil" : item.p.path}
                                  <span className="ml-2 text-xs text-slate-400">
                                    {item.p.engagedSec ? fmtDuration(item.p.engagedSec) : ""}
                                    {item.p.scrollPct ? ` · lu à ${item.p.scrollPct} %` : ""}
                                  </span>
                                </span>
                              </li>
                            ) : (
                              <li key={i} className="flex gap-3">
                                <span className="w-11 shrink-0 tabular-nums text-xs text-slate-400">{time(item.at)}</span>
                                <span className="text-xs font-medium text-violet-700">
                                  ● {eventLabel(item.e.name)}
                                  {eventDetail(item.e) && <span className="ml-1 font-normal text-slate-500">— {eventDetail(item.e)}</span>}
                                </span>
                              </li>
                            )
                          )}
                      </ol>
                      <div className="text-[11px] text-slate-400">
                        {s.os ?? ""} {s.region ? `· ${s.region}` : ""}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <button className="abtn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ← Plus récentes
              </button>
              <span className="text-xs text-slate-400">
                Page {page + 1} / {pages}
              </span>
              <button className="abtn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Plus anciennes →
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
