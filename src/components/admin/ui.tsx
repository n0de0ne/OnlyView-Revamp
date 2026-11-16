"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* ───────────────────────── fetch helper ───────────────────────── */

export async function api<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T & { success: boolean; error?: string }> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("unauthenticated");
  }
  const data = await res.json().catch(() => ({ success: false, error: "bad_response" }));
  return data;
}

/* ───────────────────────── toasts ───────────────────────── */

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}

const ToastCtx = createContext<{ push: (m: string, k?: Toast["kind"]) => void }>({
  push: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] right-4 z-[200] lg:bottom-5 lg:right-5 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#1a1714] py-3 pl-4 pr-5 text-sm text-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)]"
          >
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                t.kind === "success" ? "bg-emerald-400" : t.kind === "error" ? "bg-red-400" : "bg-gold"
              }`}
            />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ───────────────────────── primitives ───────────────────────── */

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold text-slate-800">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export const STATUS_LABELS: Record<string, string> = {
  option: "Option",
  confirmed: "Confirmé",
  pending: "En attente",
  cancelled: "Annulé",
  blocked: "Bloqué",
};

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    option: "bg-amber-50 text-amber-800 ring-amber-200",
    confirmed: "bg-red-50 text-red-800 ring-red-200",
    pending: "bg-violet-50 text-violet-800 ring-violet-200",
    cancelled: "bg-slate-50 text-slate-500 ring-slate-200 line-through",
    blocked: "bg-slate-100 text-slate-600 ring-slate-200",
    // contracts / requests
    signed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    void: "bg-slate-50 text-slate-500 ring-slate-200",
    expired: "bg-slate-50 text-slate-500 ring-slate-200",
    new: "bg-sky-50 text-sky-800 ring-sky-200",
    answered: "bg-amber-50 text-amber-800 ring-amber-200",
    converted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    declined: "bg-slate-50 text-slate-500 ring-slate-200",
    sent: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    queued: "bg-amber-50 text-amber-800 ring-amber-200",
    failed: "bg-red-50 text-red-800 ring-red-200",
  };
  const labels: Record<string, string> = {
    ...STATUS_LABELS,
    signed: "Signé",
    void: "Annulé",
    expired: "Expiré",
    new: "Nouveau",
    answered: "Répondu",
    converted: "Converti",
    declined: "Refusé",
    sent: "Envoyé",
    queued: "En file",
    failed: "Échec",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[status] ?? status}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-[#1a1714]/45 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[94svh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white shadow-[0_30px_80px_-20px_rgba(26,23,20,0.5)] sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h2 className="font-display text-xl font-medium text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  className = "abtn-danger",
  confirmLabel = "Confirmer ?",
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none" aria-label="Chargement">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ───────────────────────── seasons ─────────────────────────
 * The villa year runs September → August, so every period selector in the
 * back-office picks a *season*, named after the year it starts in.
 */

/** Month labels in season order (September first). */
export const SEASON_MONTH_LABELS = [
  "Sep", "Oct", "Nov", "Déc", "Jan", "Fév",
  "Mar", "Avr", "Mai", "Juin", "Juil", "Août",
];

export const SEASON_MONTH_NAMES = [
  "Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février",
  "Mars", "Avril", "Mai", "Juin", "Juillet", "Août",
];

/** ‹ 2025 – 2026 › — the standard period control of the back-office. */
export function SeasonPicker({
  season,
  onChange,
  count = 6,
}: {
  season: number;
  onChange: (s: number) => void;
  /** how many past seasons to offer in the dropdown */
  count?: number;
}) {
  const current = seasonOfDate(new Date());
  const options = Array.from({ length: count }, (_, i) => current + 1 - i);
  if (!options.includes(season)) options.push(season);
  options.sort((a, b) => b - a);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white p-0.5">
      <button
        onClick={() => onChange(season - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 sm:h-8 sm:w-8 hover:bg-slate-100"
        aria-label="Saison précédente"
      >
        ‹
      </button>
      <select
        value={season}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="cursor-pointer appearance-none bg-transparent px-1 py-1.5 text-center text-sm font-semibold text-navy focus:outline-none"
        aria-label="Saison"
        title="Saison : 1ᵉʳ septembre → 31 août"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            Saison {s} – {s + 1}
            {s === current ? " (en cours)" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => onChange(season + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 sm:h-8 sm:w-8 hover:bg-slate-100"
        aria-label="Saison suivante"
      >
        ›
      </button>
    </div>
  );
}

/** Client-side twin of lib/dates seasonOf (no server-only import in components). */
export function seasonOfDate(d: Date | string): number {
  const iso = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const year = parseInt(iso.slice(0, 4), 10);
  return parseInt(iso.slice(5, 7), 10) >= 9 ? year : year - 1;
}

export const seasonLabel = (season: number) => `${season} – ${season + 1}`;

/* ───────────────────────── formatting ───────────────────────── */

export const fmtUSD = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const fmtEUR = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};
