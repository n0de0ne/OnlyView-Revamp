"use client";

import { useMemo, useState } from "react";

export interface BookedRange {
  start: string;
  end: string;
  status: "confirmed" | "option";
}

interface Props {
  bookings: BookedRange[];
  months?: number;
  locale: "en" | "fr";
  value?: { start: string | null; end: string | null };
  onChange?: (range: { start: string | null; end: string | null }) => void;
  legend: { free: string; booked: string; option: string };
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Availability calendar with range selection.
 * Checkout-day semantics: a reservation's end date is free for a new arrival,
 * shown as a half-day split.
 */
export function AvailabilityCalendar({
  bookings,
  months = 2,
  locale,
  value,
  onChange,
  legend,
}: Props) {
  const today = new Date();
  const [offset, setOffset] = useState(0);
  const [internal, setInternal] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const range = value ?? internal;
  const setRange = (r: { start: string | null; end: string | null }) => {
    setInternal(r);
    onChange?.(r);
  };

  const todayISO = iso(today.getFullYear(), today.getMonth(), today.getDate());

  const dayStatus = useMemo(() => {
    const map = new Map<string, { isStart: boolean; isEnd: boolean; status: string }>();
    for (const b of bookings) {
      let cur = b.start;
      while (cur < b.end) {
        const prev = map.get(cur);
        map.set(cur, {
          isStart: cur === b.start || Boolean(prev?.isStart),
          isEnd: false,
          status: b.status === "confirmed" || prev?.status === "confirmed" ? "confirmed" : "option",
        });
        const d = new Date(cur + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        cur = d.toISOString().slice(0, 10);
      }
      // checkout day marker (free half-day)
      const end = map.get(b.end);
      if (!end) map.set(b.end, { isStart: false, isEnd: true, status: b.status });
    }
    return map;
  }, [bookings]);

  const isNightBooked = (d: string) => {
    const s = dayStatus.get(d);
    return Boolean(s && !s.isEnd);
  };

  const rangeConflicts = (start: string, end: string) => {
    let cur = start;
    while (cur < end) {
      if (isNightBooked(cur)) return true;
      const d = new Date(cur + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      cur = d.toISOString().slice(0, 10);
    }
    return false;
  };

  const clickDay = (d: string) => {
    if (d < todayISO) return;
    if (!range.start || (range.start && range.end)) {
      setRange({ start: d, end: null });
      return;
    }
    if (d <= range.start) {
      setRange({ start: d, end: null });
      return;
    }
    if (rangeConflicts(range.start, d)) {
      setRange({ start: d, end: null });
      return;
    }
    setRange({ start: range.start, end: d });
  };

  const monthNames =
    locale === "fr"
      ? ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = locale === "fr" ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];

  const renderMonth = (mOffset: number) => {
    const base = new Date(today.getFullYear(), today.getMonth() + offset + mOffset, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first

    const cells: Array<{ d: number; date: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ d, date: iso(y, m, d) });

    return (
      // a phone shows one month (arrows beside its name); two from lg up
      <div key={mOffset} className={`w-full ${mOffset > 0 ? "hidden lg:block" : ""}`}>
        <div className="mb-2 flex items-center justify-between lg:mb-3 lg:block lg:text-center">
          {mOffset === 0 && <span className="lg:hidden">{prevButton}</span>}
          <span className="font-display text-xl lg:text-lg">
            {monthNames[m]} {y}
          </span>
          {mOffset === 0 && <span className="lg:hidden">{nextButton}</span>}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[0.72rem] uppercase text-ink/40 lg:text-[0.65rem]">
          {dayNames.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5 lg:gap-y-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const s = dayStatus.get(cell.date);
            const past = cell.date < todayISO;
            const isCheckoutOnly = Boolean(s?.isEnd && !isNightBooked(cell.date));
            const booked = isNightBooked(cell.date);
            const selStart = range.start === cell.date;
            const selEnd = range.end === cell.date;
            const inSel =
              range.start &&
              range.end &&
              cell.date > range.start &&
              cell.date < range.end;

            let cls = "bg-st-free/12 text-ink hover:bg-gold/25";
            if (past) cls = "text-ink/25 cursor-default";
            else if (booked && s?.status === "confirmed")
              cls = "bg-st-confirmed/85 text-white cursor-not-allowed";
            else if (booked) cls = "bg-st-option/85 text-white cursor-not-allowed";
            else if (isCheckoutOnly)
              cls = "bg-gradient-to-br from-st-confirmed/60 from-50% to-st-free/15 to-50% text-ink hover:bg-gold/25";
            if (selStart || selEnd) cls = "bg-gold text-white font-semibold";
            else if (inSel) cls = "bg-gold/30 text-ink";

            return (
              <button
                key={cell.date}
                disabled={past || booked}
                onClick={() => clickDay(cell.date)}
                aria-label={cell.date}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition lg:h-9 lg:w-9 lg:text-xs ${cls}`}
              >
                {cell.d}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const navCls =
    "flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-lg transition hover:border-gold hover:text-gold disabled:opacity-30 lg:h-9 lg:w-9 lg:text-base";
  const prevButton = (
    <button
      onClick={() => setOffset((o) => Math.max(0, o - 1))}
      disabled={offset === 0}
      className={navCls}
      aria-label="Previous month"
    >
      ‹
    </button>
  );
  const nextButton = (
    <button
      onClick={() => setOffset((o) => Math.min(22, o + 1))}
      className={navCls}
      aria-label="Next month"
    >
      ›
    </button>
  );
  const legendRow = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-st-free/30 lg:h-3 lg:w-3" /> {legend.free}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-st-option lg:h-3 lg:w-3" /> {legend.option}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-st-confirmed lg:h-3 lg:w-3" /> {legend.booked}
      </span>
    </>
  );

  return (
    <div>
      <div className="mb-4 hidden items-center justify-between lg:flex">
        {prevButton}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.65rem] uppercase tracking-wider text-ink/60">
          {legendRow}
        </div>
        {nextButton}
      </div>
      <div className={`grid gap-8 ${months > 1 ? "lg:grid-cols-2" : ""}`}>
        {Array.from({ length: months }, (_, i) => renderMonth(i))}
      </div>
      {/* on a phone the legend is one quiet line under the month */}
      <div className="mt-3 flex justify-center gap-x-4 text-[0.7rem] text-ink/65 lg:hidden">
        {legendRow}
      </div>
    </div>
  );
}
