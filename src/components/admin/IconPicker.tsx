"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ICONS, iconFor, LineIcon } from "../LineIcon";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Choose one of the site's line icons: a button showing the current one,
 * opening a searchable grid. Stores the icon's key (e.g. "wifi").
 */
export function IconPicker({ value, onChange, allowNone = false }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const list = useMemo(() => {
    const f = fold(q.trim());
    return Object.entries(ICONS).filter(([k, [, label]]) => !f || fold(label).includes(f) || k.toLowerCase().includes(f));
  }, [q]);

  const current = ICONS[value]?.[1] ?? (value ? (iconFor(value) ? "ancien emoji" : value) : "Aucune");

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10">
          <LineIcon name={value} className="h-5 w-5 text-gold" />
        </span>
        <span className="flex-1 truncate">{current}</span>
        <span className="text-xs text-slate-400">Changer</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 min-w-[18rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (piscine, plage, wifi…)" className="mb-2" />
          <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {allowNone && (
              <button
                type="button"
                title="Aucune"
                onClick={() => (onChange(""), setOpen(false))}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs text-slate-400 hover:bg-slate-100 ${!value ? "ring-2 ring-gold" : ""}`}
              >
                —
              </button>
            )}
            {list.map(([k, [, label]]) => (
              <button
                key={k}
                type="button"
                title={label}
                onClick={() => (onChange(k), setOpen(false), setQ(""))}
                className={`flex aspect-square items-center justify-center rounded-lg hover:bg-gold/10 ${value === k ? "bg-gold/10 ring-2 ring-gold" : ""}`}
              >
                <LineIcon name={k} className="h-5 w-5 text-gold" />
              </button>
            ))}
          </div>
          {list.length === 0 && <p className="p-2 text-xs text-slate-400">Aucune icône pour « {q} »</p>}
        </div>
      )}
    </div>
  );
}
