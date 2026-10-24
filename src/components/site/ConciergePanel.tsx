"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { ConciergeCatalog } from "@/lib/concierge";
import type { PlannerItem } from "./StayPlanner";

type Tab = "restaurants" | "boats" | "chef" | "taxis";
type Target = { type: "restaurant" | "boat" | "chef"; id: number };

/** StayPlanner listens for this to list the new request with the guest's other extras. */
export const EXTRA_ADDED_EVENT = "onlyview:extra-added";

const fill = (s: string, n: number) => s.replace("{n}", String(n));
const money = (n: number, currency: string) =>
  (currency === "EUR" ? "€" : "$") + Math.round(n).toLocaleString("en-US");

/**
 * Guest portal — the concierge for one upcoming stay: book a table, a boat
 * day or a private chef (the owner confirms), or call a taxi directly.
 */
export function ConciergePanel({
  reservationId,
  locale,
  t,
  catalog,
  stay,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"]["concierge"];
  catalog: ConciergeCatalog;
  /** first and last day the guest is on the island, YYYY-MM-DD */
  stay: { start: string; end: string; guests: number };
}) {
  const tabs = (["restaurants", "boats", "chef", "taxis"] as const).filter((k) => catalog[k].length > 0);
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "restaurants");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [form, setForm] = useState({ date: "", time: "20:00", guests: String(stay.guests), outing: "", notes: "" });
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [sent, setSent] = useState<string | null>(null);

  if (tabs.length === 0) return null;

  const open = (next: Target, outing = "") => {
    setTarget(next);
    setState("idle");
    setSent(null);
    setForm((f) => ({ ...f, outing, date: f.date || stay.start }));
  };
  const isOpen = (type: Target["type"], id: number) => target?.type === type && target.id === id;
  const match = (...parts: Array<string | null | undefined>) =>
    !q.trim() || parts.join(" ").toLowerCase().includes(q.trim().toLowerCase());

  const send = async () => {
    if (!target) return;
    setState("sending");
    const res = await fetch(`/api/account/reservations/${reservationId}/concierge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: target.type,
        id: target.id,
        date: form.date,
        time: target.type === "boat" ? undefined : form.time || null,
        outing: target.type === "boat" ? form.outing : undefined,
        guests: Math.max(1, parseInt(form.guests, 10) || 1),
        notes: form.notes || null,
        locale,
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (!data?.success) return setState("error");
    window.dispatchEvent(
      new CustomEvent<{ reservationId: number; item: PlannerItem }>(EXTRA_ADDED_EVENT, {
        detail: { reservationId, item: data.item },
      })
    );
    setSent(data.item.label);
    setTarget(null);
    setState("idle");
    setForm((f) => ({ ...f, notes: "" }));
  };

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div className="field">
      <label htmlFor={`cg-${key}-${reservationId}`}>{label}</label>
      <input
        id={`cg-${key}-${reservationId}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  const requestForm = (withTime: boolean, outings?: Array<{ key: string; price: number }>, currency = "USD") => (
    <div className="mt-3 grid gap-3 border-t border-ink/8 pt-3 sm:grid-cols-3">
      {outings && (
        <div className="field sm:col-span-3">
          <label htmlFor={`cg-outing-${reservationId}`}>{t.outing}</label>
          <select
            id={`cg-outing-${reservationId}`}
            value={form.outing}
            onChange={(e) => setForm({ ...form, outing: e.target.value })}
          >
            {outings.map((o) => (
              <option key={o.key} value={o.key}>
                {t.outings[o.key]} · {money(o.price, currency)}
              </option>
            ))}
          </select>
        </div>
      )}
      {field("date", t.date, { type: "date", min: stay.start, max: stay.end, required: true })}
      {withTime && field("time", t.time, { type: "time", step: 900 })}
      {field("guests", t.guests, { type: "number", min: 1, max: 100, inputMode: "numeric" })}
      <div className={`field ${withTime ? "sm:col-span-3" : ""}`}>
        <label htmlFor={`cg-notes-${reservationId}`}>{t.note}</label>
        <input
          id={`cg-notes-${reservationId}`}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button
          type="button"
          onClick={send}
          disabled={state === "sending" || !form.date}
          className="btn-gold !px-5 !py-2.5 text-xs"
        >
          {t.send}
        </button>
        <button type="button" onClick={() => setTarget(null)} className="text-xs text-ink/50 underline">
          ✕
        </button>
        {state === "error" && <span className="text-sm text-red-600">{t.error}</span>}
      </div>
    </div>
  );

  const cardClass = "border border-ink/10 px-4 py-3";
  const actionClass = "mt-2 text-xs font-semibold uppercase tracking-widest text-gold";
  const thumb = (src: string | null) =>
    src ? (
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-16 w-20 shrink-0 object-cover"
        // legacy photos are hotlinked from other sites; a dead link just disappears
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    ) : null;

  return (
    <details className="group mt-5 border-t border-ink/8 pt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="eyebrow !text-[0.6rem]">{t.title}</span>
          <span className="mt-1 block text-xs text-ink/55">{t.hint}</span>
        </span>
        <span className="text-gold transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>

      <div className="mt-5">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setTarget(null);
                setQ("");
              }}
              className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${
                tab === k ? "border-gold bg-gold text-white" : "border-ink/15 text-ink/60"
              }`}
            >
              {t.tabs[k]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-ink/55">{tab === "taxis" ? t.taxisIntro : t.intro}</p>
        {sent && (
          <p className="mt-3 text-sm text-st-free" role="status">
            ✓ {sent} — {t.sent}
          </p>
        )}
        {(tab === "restaurants" || tab === "taxis") && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="mt-3 w-full border border-ink/15 px-3 py-2 text-sm sm:w-64"
          />
        )}

        <ul className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto pr-1">
          {tab === "restaurants" &&
            catalog.restaurants
              .filter((r) => match(r.name, r.zone, r.cuisine))
              .map((r) => (
                <li key={r.id} className={cardClass}>
                  <div className="flex gap-3">
                    {thumb(r.imageUrl)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold">{r.name}</span>
                        {r.priceRange && <span className="text-xs text-ink/45">{"$".repeat(r.priceRange)}</span>}
                      </div>
                      <div className="text-xs text-ink/55">{[r.zone, r.cuisine].filter(Boolean).join(" · ")}</div>
                      {r.description && <p className="mt-1 line-clamp-2 text-xs text-ink/60">{r.description}</p>}
                    </div>
                  </div>
                  {isOpen("restaurant", r.id) ? (
                    requestForm(true)
                  ) : r.bookingMode === "none" ? (
                    <p className="mt-2 text-xs text-ink/50">{t.walkIn}</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <button type="button" onClick={() => open({ type: "restaurant", id: r.id })} className={actionClass}>
                        + {t.bookTable}
                      </button>
                      {r.bookingMode === "direct" && r.bookingUrl && (
                        <a href={r.bookingUrl} target="_blank" rel="noopener" className={`${actionClass} !text-ink/50`}>
                          {t.bookOnline} ↗
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}

          {tab === "boats" &&
            catalog.boats.map((b) => {
              const from = b.outings.length ? Math.min(...b.outings.map((o) => o.price)) : null;
              return (
                <li key={b.id} className={cardClass}>
                  <div className="flex gap-3">
                    {thumb(b.imageUrl)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold">{b.name}</span>
                        <span className="text-sm">
                          {from != null ? (
                            <>
                              <span className="text-xs text-ink/45">{t.from} </span>
                              <span className="font-semibold">{money(from, b.currency)}</span>
                            </>
                          ) : (
                            <span className="text-xs text-ink/55">{t.onQuote}</span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-ink/55">
                        {[b.type, b.length, fill(t.upTo, b.capacity)].filter(Boolean).join(" · ")}
                      </div>
                      {b.description && <p className="mt-1 line-clamp-2 text-xs text-ink/60">{b.description}</p>}
                      {b.includes && (
                        <p className="mt-1 text-xs text-ink/50">
                          <span className="font-semibold">{t.includes} :</span> {b.includes}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOpen("boat", b.id)
                    ? requestForm(false, b.outings, b.currency)
                    : b.outings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => open({ type: "boat", id: b.id }, b.outings[0].key)}
                          className={actionClass}
                        >
                          + {t.bookBoat}
                        </button>
                      )}
                </li>
              );
            })}

          {tab === "chef" &&
            catalog.chef.map((o, i) => (
              <li key={o.id} className={cardClass}>
                {(i === 0 || catalog.chef[i - 1].category !== o.category) && (
                  <div className="eyebrow mb-2 !text-[0.6rem]">{t.chefCategories[o.category] ?? o.category}</div>
                )}
                <div className="flex gap-3">
                  {thumb(o.imageUrl)}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{o.name}</span>
                      <span className="text-sm">
                        {o.price != null ? (
                          <>
                            <span className="font-semibold">{money(o.price, o.currency)}</span>
                            <span className="ml-1 text-xs text-ink/45">{t.priceTypes[o.priceType]}</span>
                          </>
                        ) : (
                          <span className="text-xs text-ink/55">{t.onQuote}</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-ink/55">
                      {[o.formula, o.duration, fill(t.minGuests, o.minimumGuests)].filter(Boolean).join(" · ")}
                    </div>
                    {o.description && <p className="mt-1 text-xs text-ink/60">{o.description}</p>}
                    {o.menu && (
                      <p className="mt-1 whitespace-pre-line text-xs text-ink/50">
                        <span className="font-semibold">{t.menu} :</span> {o.menu}
                      </p>
                    )}
                  </div>
                </div>
                {isOpen("chef", o.id) ? (
                  requestForm(true)
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      open({ type: "chef", id: o.id });
                      setForm((f) => ({ ...f, guests: String(Math.max(stay.guests, o.minimumGuests)) }));
                    }}
                    className={actionClass}
                  >
                    + {t.bookChef}
                  </button>
                )}
              </li>
            ))}

          {tab === "taxis" &&
            catalog.taxis
              .filter((x) => match(x.name, x.zone))
              .map((x) => (
                <li key={x.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
                  <span>
                    <span className="font-semibold">{x.name}</span>
                    <span className="block text-xs text-ink/55">
                      {[x.displayPhone, x.zone].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex gap-4 text-xs font-semibold uppercase tracking-widest">
                    <a href={`tel:${x.phone}`} className="text-gold">
                      {t.call}
                    </a>
                    {x.hasWhatsapp && (
                      <a
                        href={`https://wa.me/${x.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener"
                        className="text-gold"
                      >
                        {t.whatsapp}
                      </a>
                    )}
                  </span>
                </li>
              ))}
        </ul>
      </div>
    </details>
  );
}
