"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { directionsHref } from "./map/map-meta";
import { CONCIERGE_ICON as ICON, REQUEST_STATUS_STYLE, requestWhen, type GuestConciergeRequest } from "./concierge-format";

export type { GuestConciergeRequest };

/** ConciergePanel fires this when a request is sent, so it joins the list at once. */
export const CONCIERGE_REQUEST_EVENT = "onlyview:concierge-request";


/**
 * Guest portal — "My concierge requests": every table, boat or chef the guest
 * asked for, with the date, time and party size, a clear status, and the
 * owner's reply. Answers the guest hasn't seen yet are highlighted.
 */
export function ConciergeRequests({
  reservationId,
  locale,
  t,
  items: initialItems,
  canWithdraw,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"]["conciergeRequests"];
  items: GuestConciergeRequest[];
  canWithdraw: boolean;
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    const onAdded = (e: Event) => {
      const { reservationId: rid, item } = (e as CustomEvent<{ reservationId: number; item: GuestConciergeRequest }>)
        .detail;
      if (rid === reservationId) setItems((list) => [...list, item]);
    };
    window.addEventListener(CONCIERGE_REQUEST_EVENT, onAdded);
    return () => window.removeEventListener(CONCIERGE_REQUEST_EVENT, onAdded);
  }, [reservationId]);

  // the highlight lasts for this visit: tell the server the answers were seen
  const hasNew = initialItems.some((i) => i.isNew);
  useEffect(() => {
    if (hasNew) fetch(`/api/account/reservations/${reservationId}/concierge/seen`, { method: "POST" }).catch(() => {});
  }, [hasNew, reservationId]);

  const withdraw = async (itemId: number) => {
    const res = await fetch(`/api/account/reservations/${reservationId}/extras/${itemId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) setItems((list) => list.filter((i) => i.id !== itemId));
  };

  if (items.length === 0) return null;
  const waiting = items.filter((i) => i.status === "requested").length;
  // the next ones first; what is over or off goes last
  const sorted = [...items].sort((a, b) => {
    const off = (i: GuestConciergeRequest) => (["declined", "cancelled"].includes(i.status) ? 1 : 0);
    return (
      off(a) - off(b) ||
      (a.serviceDate ?? "").localeCompare(b.serviceDate ?? "") ||
      (a.serviceTime ?? "").localeCompare(b.serviceTime ?? "")
    );
  });

  return (
    <section className="mt-5 border-t border-ink/8 pt-5" id={`concierge-requests-${reservationId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="eyebrow !text-[0.6rem]">{t.title}</h3>
        {waiting > 0 && (
          <span className="text-xs text-ink/55">{(waiting > 1 ? t.waitingMany : t.waitingOne).replace("{n}", String(waiting))}</span>
        )}
      </div>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((i) => (
          <li
            key={i.id}
            className={`border px-4 py-3 ${
              i.isNew ? "border-gold bg-gold/5 shadow-[0_0_0_1px] shadow-gold/40" : "border-ink/10"
            } ${["declined", "cancelled"].includes(i.status) ? "opacity-70" : ""}`}
          >
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>{ICON[i.category ?? ""] ?? "🛎️"}</span>
                  <span className="font-semibold">{i.label.replace(/^Restaurant — /, "")}</span>
                  {i.isNew && (
                    <span className="bg-gold px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-widest text-white">
                      {t.new}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-ink/75">{requestWhen(i, locale, t)}</div>
              </div>
              <span
                className={`shrink-0 self-start border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-widest ${
                  REQUEST_STATUS_STYLE[i.status] ?? REQUEST_STATUS_STYLE.requested
                }`}
              >
                {i.status === "confirmed" && "✓ "}
                {t.statuses[i.status] ?? i.status}
              </span>
            </div>
            {i.status === "requested" && <p className="mt-1.5 text-xs text-ink/50">{t.requestedHint}</p>}
            {i.adminNote && (
              <p className="mt-2 border-l-2 border-gold bg-ink/[0.03] px-3 py-2 text-sm text-ink/80">
                <span className="text-xs font-semibold text-ink/55">{t.ourReply} </span>
                {i.adminNote}
              </p>
            )}
            {(i.placeSlug && !["declined", "cancelled"].includes(i.status)) || (canWithdraw && i.status === "requested") ? (
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                {i.placeSlug && !["declined", "cancelled"].includes(i.status) && (
                  <a href={directionsHref(locale, i.placeSlug)} className="text-gold underline">
                    {t.directions}
                  </a>
                )}
                {canWithdraw && i.status === "requested" && (
                  <button type="button" onClick={() => withdraw(i.id)} className="text-ink/40 underline">
                    {t.withdraw}
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
