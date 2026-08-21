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
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${
              t.kind === "success"
                ? "bg-emerald-600"
                : t.kind === "error"
                  ? "bg-red-600"
                  : "bg-slate-700"
            }`}
          >
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
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
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
    option: "bg-amber-100 text-amber-700",
    confirmed: "bg-red-100 text-red-700",
    pending: "bg-violet-100 text-violet-700",
    cancelled: "bg-slate-100 text-slate-500 line-through",
    blocked: "bg-slate-200 text-slate-600",
    // contracts / requests
    signed: "bg-emerald-100 text-emerald-700",
    void: "bg-slate-100 text-slate-500",
    expired: "bg-slate-100 text-slate-500",
    new: "bg-blue-100 text-blue-700",
    answered: "bg-amber-100 text-amber-700",
    converted: "bg-emerald-100 text-emerald-700",
    declined: "bg-slate-100 text-slate-500",
    sent: "bg-emerald-100 text-emerald-700",
    queued: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}
    >
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
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[94svh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
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
