"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { extraThumb, isRental, lineAmount, moneyIn, rentalDays } from "@/lib/extras";

export interface PlannerExtra {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  category: string | null;
  imageUrl: string | null;
  currency: string;
  /** supplied and billed by a rental company */
  provider: string | null;
}

export interface PlannerItem {
  id: number;
  label: string;
  quantity: number;
  amount: number;
  currency: string;
  paidToProvider: boolean;
  status: string;
  serviceDate: string | null;
  serviceEndDate: string | null;
  days: number | null;
  requestedByGuest: boolean;
}

const fmtDay = (iso: string, locale: "en" | "fr") =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Guest portal — extras for one upcoming stay: the catalog by category, with
 * photos; rentals by the day are booked from a start to an end date (the day
 * count and total are shown as the guest picks them), like St Barth
 * Provider's own booking site. Collapsed by default.
 */
export function ExtrasPanel({
  reservationId,
  locale,
  t,
  catalog,
  items: initialItems,
  stay,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"];
  catalog: PlannerExtra[];
  items: PlannerItem[];
  /** first and last day of the stay, YYYY-MM-DD — the default rental range */
  stay: { start: string; end: string };
}) {
  const [items, setItems] = useState(initialItems);
  const [picking, setPicking] = useState<number | null>(null);
  const blank = { quantity: 1, serviceDate: "", serviceEndDate: "", notes: "" };
  const [req, setReq] = useState(blank);
  const [reqError, setReqError] = useState(false);
  const categories = [...new Set(catalog.map((x) => x.category ?? ""))];
  const [cat, setCat] = useState(categories[0] ?? "");
  const providers = [...new Set(catalog.map((x) => x.provider).filter(Boolean))] as string[];
  const dayLabel = (n: number) => (n > 1 ? t.dayMany.replace("{n}", String(n)) : t.dayOne);

  const pick = (x: PlannerExtra) => {
    setPicking(x.id);
    setReqError(false);
    setReq(isRental(x.unit) ? { ...blank, serviceDate: stay.start, serviceEndDate: stay.end } : blank);
  };

  const requestExtra = async (x: PlannerExtra) => {
    setReqError(false);
    const rental = isRental(x.unit);
    const res = await fetch(`/api/account/reservations/${reservationId}/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extraId: x.id,
        quantity: req.quantity,
        serviceDate: req.serviceDate || null,
        serviceEndDate: rental ? req.serviceEndDate || null : null,
        notes: req.notes || null,
        locale,
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data?.success) {
      setItems([...items, data.item]);
      setPicking(null);
      setReq(blank);
    } else setReqError(true);
  };

  const withdraw = async (itemId: number) => {
    const res = await fetch(`/api/account/reservations/${reservationId}/extras/${itemId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) setItems(items.filter((i) => i.id !== itemId));
  };

  const dateField = (key: "serviceDate" | "serviceEndDate", label: string, x: PlannerExtra, min?: string) => (
    <div className="field">
      <label htmlFor={`${key}-${x.id}-${reservationId}`}>{label}</label>
      <input
        id={`${key}-${x.id}-${reservationId}`}
        type="date"
        min={min}
        value={req[key]}
        onChange={(e) => {
          const v = e.target.value;
          // an end before the start follows the start
          setReq((r) =>
            key === "serviceDate" && r.serviceEndDate && v > r.serviceEndDate
              ? { ...r, serviceDate: v, serviceEndDate: v }
              : { ...r, [key]: v }
          );
        }}
      />
    </div>
  );

  const stepper = (x: PlannerExtra) => (
    <div className="field">
      <label htmlFor={`q-${x.id}-${reservationId}`}>{t.quantity}</label>
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label="−"
          onClick={() => setReq((r) => ({ ...r, quantity: Math.max(1, r.quantity - 1) }))}
          className="w-10 border border-ink/15 text-lg leading-none"
        >
          −
        </button>
        <input
          id={`q-${x.id}-${reservationId}`}
          type="number"
          min={1}
          max={99}
          value={req.quantity}
          onChange={(e) => setReq({ ...req, quantity: Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
          className="!w-16 text-center"
        />
        <button
          type="button"
          aria-label="+"
          onClick={() => setReq((r) => ({ ...r, quantity: Math.min(99, r.quantity + 1) }))}
          className="w-10 border border-ink/15 text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <details className="group mt-5 border-t border-ink/8 pt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="eyebrow !text-[0.6rem]">{t.extrasTitle}</span>
          <span className="mt-1 block text-xs text-ink/55">
            {t.extrasHint}
            {items.length > 0 && (
              <span className="ml-1 text-ink/70">
                · {t.yourExtras} ({items.length})
              </span>
            )}
          </span>
        </span>
        <span className="text-gold transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>

      <div className="mt-5">
        <p className="text-xs text-ink/55">{catalog.length ? t.extrasIntro : t.extrasNone}</p>

        {items.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow !text-[0.6rem]">{t.yourExtras}</div>
            <ul className="mt-2 divide-y divide-ink/8 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.label}
                    {i.amount > 0 && <span className="ml-2 text-ink/50">{moneyIn(i.amount, i.currency)}</span>}
                    {i.serviceDate && (
                      <span className="block text-xs text-ink/50">
                        {fmtDay(i.serviceDate, locale)}
                        {i.serviceEndDate && <> → {fmtDay(i.serviceEndDate, locale)}</>}
                        {i.days != null && <> · {dayLabel(i.days)}</>}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span
                      className={
                        i.status === "confirmed"
                          ? "text-st-free"
                          : i.status === "cancelled"
                            ? "text-ink/40"
                            : "text-st-option"
                      }
                    >
                      {t.extraStatuses[i.status] ?? i.status}
                    </span>
                    {i.status === "requested" && i.requestedByGuest && (
                      <button type="button" onClick={() => withdraw(i.id)} className="text-ink/40 underline">
                        {t.withdraw}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {providers.length > 0 && (
          <p className="mt-4 text-xs text-ink/55">{t.providerNote.replace("{name}", providers.join(", "))}</p>
        )}
        {categories.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" role="tablist">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cat === c}
                onClick={() => {
                  setCat(c);
                  setPicking(null);
                }}
                className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest ${
                  cat === c ? "border-gold bg-gold text-white" : "border-ink/15 text-ink/60"
                }`}
              >
                {c || t.extrasOther}
              </button>
            ))}
          </div>
        )}
        {catalog.length > 0 && (
          <ul className="mt-4 max-h-[40rem] space-y-3 overflow-y-auto pr-1" data-lenis-prevent>
            {catalog
              .filter((x) => categories.length < 2 || (x.category ?? "") === cat)
              .map((x) => {
                const rental = isRental(x.unit);
                const days =
                  rental && req.serviceDate && req.serviceEndDate ? rentalDays(req.serviceDate, req.serviceEndDate) : null;
                return (
                  <li key={x.id} className="border border-ink/10 px-4 py-3">
                    <div className="flex gap-3">
                      {x.imageUrl && (
                        <img
                          src={extraThumb(x.imageUrl)}
                          alt=""
                          loading="lazy"
                          className="h-20 w-20 shrink-0 bg-white object-contain"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{x.name}</div>
                        {x.description && <div className="mt-0.5 text-xs text-ink/55">{x.description}</div>}
                        <div className="mt-1 text-sm">
                          {x.price > 0 ? (
                            <>
                              <span className="font-semibold">{moneyIn(x.price, x.currency)}</span>
                              <span className="ml-1 text-xs text-ink/45">
                                {(x.provider && rental ? t.perDay : t.units[x.unit]) ?? ""}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-ink/55">{t.onRequest}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {picking === x.id ? (
                      <div className="mt-3 grid gap-3 border-t border-ink/8 pt-3 sm:grid-cols-3">
                        {stepper(x)}
                        {rental ? (
                          <>
                            {dateField("serviceDate", t.startDate, x)}
                            {dateField("serviceEndDate", t.endDate, x, req.serviceDate || undefined)}
                          </>
                        ) : (
                          <div className="sm:col-span-2">{dateField("serviceDate", t.serviceDate, x)}</div>
                        )}
                        {days != null && (
                          <p className="text-sm sm:col-span-3" role="status">
                            <span className="font-semibold">{dayLabel(days)}</span>
                            {x.price > 0 && (
                              <span className="text-ink/60">
                                {" "}
                                · {req.quantity} × {moneyIn(x.price, x.currency)} × {days} ={" "}
                                <span className="font-semibold text-ink">
                                  {moneyIn(lineAmount(req.quantity, x.price, days), x.currency)}
                                </span>
                              </span>
                            )}
                          </p>
                        )}
                        <div className="field sm:col-span-3">
                          <label htmlFor={`n-${x.id}-${reservationId}`}>{t.note}</label>
                          <input
                            id={`n-${x.id}-${reservationId}`}
                            value={req.notes}
                            onChange={(e) => setReq({ ...req, notes: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                          <button
                            type="button"
                            onClick={() => requestExtra(x)}
                            disabled={rental && (!req.serviceDate || !req.serviceEndDate)}
                            className="btn-gold !px-5 !py-2.5 text-xs"
                          >
                            {t.requestExtra}
                          </button>
                          <button type="button" onClick={() => setPicking(null)} className="text-xs text-ink/50 underline">
                            ✕
                          </button>
                          {reqError && <span className="text-sm text-red-600">{t.saveError}</span>}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pick(x)}
                        className="mt-2 text-xs font-semibold uppercase tracking-widest text-gold"
                      >
                        + {t.requestExtra}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </details>
  );
}
