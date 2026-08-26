"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SerializedReservation } from "@/lib/reservations";
import { api, fmtUSD, SEASON_MONTH_NAMES, SeasonPicker, seasonLabel, seasonOfDate, Spinner } from "./ui";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

const STATUS_BG: Record<string, string> = {
  confirmed: "#dc2626",
  option: "#f59e0b",
  pending: "#8b5cf6",
  blocked: "#64748b",
};

interface DayInfo {
  reservation?: SerializedReservation;
  isStart?: boolean;
  isEnd?: boolean; // checkout day
  endReservation?: SerializedReservation;
}

export function AdminCalendar() {
  const router = useRouter();
  const [season, setSeason] = useState(() => seasonOfDate(new Date()));
  const [reservations, setReservations] = useState<SerializedReservation[] | null>(null);
  const [hover, setHover] = useState<SerializedReservation | null>(null);

  useEffect(() => {
    setReservations(null);
    api<{ reservations: SerializedReservation[] }>(
      `/api/admin/reservations?season=${season}`
    ).then((d) => d.success && setReservations(d.reservations));
  }, [season]);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayInfo>();
    if (!reservations) return map;
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      let cur = r.startDate;
      while (cur < r.endDate) {
        const info = map.get(cur) ?? {};
        info.reservation = r;
        if (cur === r.startDate) info.isStart = true;
        map.set(cur, info);
        const d = new Date(cur + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        cur = d.toISOString().slice(0, 10);
      }
      const endInfo = map.get(r.endDate) ?? {};
      endInfo.isEnd = true;
      endInfo.endReservation = r;
      map.set(r.endDate, endInfo);
    }
    return map;
  }, [reservations]);

  const todayISO = new Date().toISOString().slice(0, 10);

  /** `slot` 0–11 walks the season: 0 = September of the opening year. */
  const renderMonth = (slot: number) => {
    const offset = 8 + slot; // September is month index 8
    const year = season + Math.floor(offset / 12);
    const m = offset % 12;
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const firstWeekday = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7;
    const cells: Array<{ d: number; iso: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        d,
        iso: `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    return (
      <div key={slot} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2.5 text-sm font-semibold text-slate-700">
          {SEASON_MONTH_NAMES[slot]} {year}
        </div>
        <div className="grid grid-cols-7 text-center text-[0.6rem] uppercase text-slate-300">
          {DAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="h-8" />;
            const info = dayMap.get(cell.iso);
            const r = info?.reservation;
            const isToday = cell.iso === todayISO;

            let style: React.CSSProperties = {};
            let cls =
              "relative flex h-8 items-center justify-center text-xs transition cursor-pointer ";
            if (r) {
              const color = STATUS_BG[r.status] ?? "#94a3b8";
              if (info?.isEnd && info.endReservation && info.endReservation.id !== r.id) {
                // back-to-back: checkout + checkin same day
                const outColor = STATUS_BG[info.endReservation.status] ?? "#94a3b8";
                style = {
                  background: `linear-gradient(135deg, ${outColor} 50%, ${color} 50%)`,
                  color: "white",
                };
              } else if (info?.isStart) {
                style = {
                  background: `linear-gradient(135deg, #05966922 50%, ${color} 50%)`,
                  color: "white",
                };
              } else {
                style = { background: color, color: "white" };
              }
              cls += r.isArchived ? "opacity-50 " : "";
            } else if (info?.isEnd && info.endReservation) {
              const outColor = STATUS_BG[info.endReservation.status] ?? "#94a3b8";
              style = {
                background: `linear-gradient(135deg, ${outColor} 50%, #05966922 50%)`,
              };
            } else {
              cls += "hover:bg-emerald-50 text-slate-600 ";
            }

            return (
              <button
                key={cell.iso}
                style={style}
                className={cls + (isToday ? " ring-2 ring-navy ring-offset-1" : "")}
                title={
                  r
                    ? `${r.clientName ?? "Sans nom"} · ${r.startDate} → ${r.endDate}`
                    : cell.iso
                }
                onMouseEnter={() => r && setHover(r)}
                onMouseLeave={() => setHover(null)}
                onClick={() =>
                  r
                    ? router.push(`/admin/reservations/${r.id}`)
                    : router.push(`/admin/reservations/new?start=${cell.iso}`)
                }
              >
                {cell.d}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Calendrier</h1>
          <p className="text-xs text-slate-400">
            Saison {seasonLabel(season)} · septembre → août
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeasonPicker season={season} onChange={setSeason} />
          <Link href="/admin/reservations/new" className="abtn-gold ml-2">
            + Réservation
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {Object.entries({ confirmed: "Confirmé", option: "Option", pending: "En attente", blocked: "Bloqué" }).map(
          ([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ background: STATUS_BG[k] }} />
              {v}
            </span>
          )
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-100" /> Libre
        </span>
        {hover && (
          <span className="ml-auto rounded-lg bg-navy px-3 py-1.5 font-medium text-white">
            {hover.clientName ?? "Sans nom"} · {hover.startDate} → {hover.endDate} ·{" "}
            {fmtUSD(hover.priceTTC)}
          </span>
        )}
      </div>

      {!reservations ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 12 }, (_, slot) => renderMonth(slot))}
        </div>
      )}
    </div>
  );
}
