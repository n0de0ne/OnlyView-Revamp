"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

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

/**
 * Guest portal — arrival and departure details for one upcoming stay
 * (extras and concierge requests have their own sections).
 * Collapsed by default so the reservation card stays readable.
 */
export function StayPlanner({
  reservationId,
  t,
  details,
  defaultOpen = false,
}: {
  reservationId: number;
  t: Dict["account"];
  details: PlannerDetails;
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
    </details>
  );
}
