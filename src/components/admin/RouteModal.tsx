"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Overlay used by intercepted admin routes: the underlying page stays mounted
 * (scroll position, filters and all) and closing simply goes back in history.
 * A hard load of the same URL renders the standalone page instead.
 */
export function RouteModal({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/50 backdrop-blur-[3px] sm:items-start sm:p-6 sm:pt-10"
      onMouseDown={(e) => {
        if (!panel.current?.contains(e.target as Node)) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        ref={panel}
        className="flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-w-5xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
