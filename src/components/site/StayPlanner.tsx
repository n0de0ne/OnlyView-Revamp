"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { EXTRA_ADDED_EVENT } from "./ConciergePanel";
import { directionsHref } from "./map/map-meta";

export interface PlannerDetails {
  arrivalFlight: string | null;
  arrivalEta: string | null;
  departureFlight: string | null;
  departureEta: string | null;
  adults: number | null;
  children: number | null;
  guestNames: string | null;
  specialRequests: string | null;
}

export interface PlannerExtra {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
}

export interface PlannerItem {
  id: number;
  label: string;
  quantity: number;
  amount: number;
  status: string;
  serviceDate: string | null;
  requestedByGuest: boolean;
  /** a table request's restaurant on the island map */
  placeSlug?: string | null;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/**
 * Guest portal — arrival details and extras requests for one upcoming stay.
 * Collapsed by default so the reservation card stays readable.
 */
export function StayPlanner({
  reservationId,
  locale,
  t,
  details,
  catalog,
  items: initialItems,
  defaultOpen = false,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"];
  details: PlannerDetails;
  catalog: PlannerExtra[];
  items: PlannerItem[];
  defaultOpen?: boolean;
}) {
  const [d, setD] = useState({
    arrivalFlight: details.arrivalFlight ?? "",
    arrivalEta: details.arrivalEta ?? "",
    departureFlight: details.departureFlight ?? "",
    departureEta: details.departureEta ?? "",
    adults: details.adults != null ? String(details.adults) : "",
    children: details.children != null ? String(details.children) : "",
    guestNames: details.guestNames ?? "",
    specialRequests: details.specialRequests ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [items, setItems] = useState(initialItems);
  const [picking, setPicking] = useState<number | null>(null);
  const [req, setReq] = useState({ quantity: "1", serviceDate: "", notes: "" });
  const [reqError, setReqError] = useState(false);

  // a request sent from the concierge panel joins the list
  useEffect(() => {
    const onAdded = (e: Event) => {
      const { reservationId: rid, item } = (e as CustomEvent<{ reservationId: number; item: PlannerItem }>).detail;
      if (rid === reservationId) setItems((list) => [...list, item]);
    };
    window.addEventListener(EXTRA_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(EXTRA_ADDED_EVENT, onAdded);
  }, [reservationId]);

  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0));

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    const res = await fetch(`/api/account/reservations/${reservationId}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, adults: num(d.adults), children: num(d.children) }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  };

  const requestExtra = async (extraId: number) => {
    setReqError(false);
    const res = await fetch(`/api/account/reservations/${reservationId}/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extraId,
        quantity: Math.max(1, parseInt(req.quantity, 10) || 1),
        serviceDate: req.serviceDate || null,
        notes: req.notes || null,
        locale,
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data?.success) {
      setItems([...items, data.item]);
      setPicking(null);
      setReq({ quantity: "1", serviceDate: "", notes: "" });
    } else setReqError(true);
  };

  const withdraw = async (itemId: number) => {
    const res = await fetch(`/api/account/reservations/${reservationId}/extras/${itemId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) setItems(items.filter((i) => i.id !== itemId));
  };

  const input = (k: keyof typeof d, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`${k}-${reservationId}`}>{label}</label>
      <input
        id={`${k}-${reservationId}`}
        value={d[k]}
        onChange={(e) => {
          setD({ ...d, [k]: e.target.value });
          setState("idle");
        }}
        {...props}
      />
    </div>
  );

  return (
    <details className="group mt-5 border-t border-ink/8 pt-5" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="eyebrow !text-[0.6rem]">{t.planTitle}</span>
          <span className="mt-1 block text-xs text-ink/55">{t.planHint}</span>
        </span>
        <span className="text-gold transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>

      <form onSubmit={saveDetails} className="mt-5 space-y-4">
        <h3 className="font-display text-lg">{t.arrivalTitle}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("arrivalFlight", t.arrivalFlight, { placeholder: t.arrivalFlightPh })}
          {input("arrivalEta", t.arrivalEta, { type: "time" })}
          {input("departureFlight", t.departureFlight)}
          {input("departureEta", t.departureEta, { type: "time" })}
          {input("adults", t.adults, { type: "number", min: 0, max: 20, inputMode: "numeric" })}
          {input("children", t.children, { type: "number", min: 0, max: 20, inputMode: "numeric" })}
        </div>
        <div className="field">
          <label htmlFor={`guestNames-${reservationId}`}>{t.guestNames}</label>
          <textarea
            id={`guestNames-${reservationId}`}
            rows={3}
            value={d.guestNames}
            onChange={(e) => {
              setD({ ...d, guestNames: e.target.value });
              setState("idle");
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`specialRequests-${reservationId}`}>{t.specialRequests}</label>
          <textarea
            id={`specialRequests-${reservationId}`}
            rows={2}
            value={d.specialRequests}
            onChange={(e) => {
              setD({ ...d, specialRequests: e.target.value });
              setState("idle");
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={state === "saving"} className="btn-outline !px-5 !py-2.5 text-xs">
            {state === "saving" ? t.saving : t.saveDetails}
          </button>
          {state === "saved" && <span className="text-sm text-st-free">✓ {t.saved}</span>}
          {state === "error" && <span className="text-sm text-red-600">{t.saveError}</span>}
        </div>
      </form>

      <div className="mt-8">
        <h3 className="font-display text-lg">{t.extrasTitle}</h3>
        <p className="mt-1 text-xs text-ink/55">{catalog.length ? t.extrasIntro : t.extrasNone}</p>

        {items.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow !text-[0.6rem]">{t.yourExtras}</div>
            <ul className="mt-2 divide-y divide-ink/8 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.label}
                    {i.amount > 0 && <span className="ml-2 text-ink/50">{usd(i.amount)}</span>}
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
                    {i.placeSlug && i.status !== "cancelled" && (
                      <a href={directionsHref(locale, i.placeSlug)} className="text-gold underline">
                        {t.directions}
                      </a>
                    )}
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

        {catalog.length > 0 && (
          <ul className="mt-4 space-y-3">
            {catalog.map((x) => (
              <li key={x.id} className="border border-ink/10 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{x.name}</div>
                    {x.description && <div className="mt-0.5 text-xs text-ink/55">{x.description}</div>}
                  </div>
                  <div className="text-right text-sm">
                    {x.price > 0 ? (
                      <>
                        <span className="font-semibold">{usd(x.price)}</span>
                        <span className="ml-1 text-xs text-ink/45">{t.units[x.unit] ?? ""}</span>
                      </>
                    ) : (
                      <span className="text-xs text-ink/55">{t.onRequest}</span>
                    )}
                  </div>
                </div>
                {picking === x.id ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="field">
                      <label htmlFor={`q-${x.id}-${reservationId}`}>{t.quantity}</label>
                      <input
                        id={`q-${x.id}-${reservationId}`}
                        type="number"
                        min={1}
                        max={100}
                        value={req.quantity}
                        onChange={(e) => setReq({ ...req, quantity: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`d-${x.id}-${reservationId}`}>{t.serviceDate}</label>
                      <input
                        id={`d-${x.id}-${reservationId}`}
                        type="date"
                        value={req.serviceDate}
                        onChange={(e) => setReq({ ...req, serviceDate: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`n-${x.id}-${reservationId}`}>{t.note}</label>
                      <input
                        id={`n-${x.id}-${reservationId}`}
                        value={req.notes}
                        onChange={(e) => setReq({ ...req, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                      <button type="button" onClick={() => requestExtra(x.id)} className="btn-gold !px-5 !py-2.5 text-xs">
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
                    onClick={() => {
                      setPicking(x.id);
                      setReqError(false);
                    }}
                    className="mt-2 text-xs font-semibold uppercase tracking-widest text-gold"
                  >
                    + {t.requestExtra}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
