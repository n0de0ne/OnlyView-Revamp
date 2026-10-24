"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { clearPendingBooking, loadPendingBooking, type PendingBooking } from "@/lib/pending-booking";
import type { PlannerItem } from "./StayPlanner";

/**
 * Back from a restaurant's own booking site, the guest is asked whether they
 * booked; one tap puts the table on their stay (for their plans / itinerary).
 */
export function PendingBookingCard({
  reservationId,
  locale,
  t,
  onAdded,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"]["concierge"];
  onAdded: (item: PlannerItem) => void;
}) {
  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [reference, setReference] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "added" | "error">("idle");

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") setPending(loadPendingBooking(reservationId));
    };
    check();
    // the guest comes back to this tab after booking in another one
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [reservationId]);

  if (state === "added") return <p className="mt-5 text-sm text-st-free">✓ {t.pendingAdded}</p>;
  if (!pending) return null;

  const when = new Date(`${pending.date}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const question = t.pendingAsk
    .replace("{name}", pending.name)
    .replace("{date}", when)
    .replace("{time}", pending.time ? (locale === "fr" ? ` à ${pending.time}` : ` at ${pending.time}`) : "")
    .replace("{n}", `${pending.guests}`);

  const yes = async () => {
    setState("saving");
    const res = await fetch(`/api/account/reservations/${reservationId}/restaurant-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: pending.placeId,
        date: pending.date,
        time: pending.time,
        guests: pending.guests,
        platform: pending.platform,
        reference: reference.trim() || null,
        source: "guest",
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (!data?.success) return setState("error");
    clearPendingBooking();
    onAdded(data.item);
    setPending(null);
    setState("added");
  };
  const no = () => {
    clearPendingBooking();
    setPending(null);
  };

  return (
    <div className="mt-5 border border-gold/50 bg-gold/5 p-4 text-sm" role="status">
      <p className="font-semibold">{question}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="field !mb-0 w-48">
          <label htmlFor={`pb-ref-${reservationId}`}>{t.pendingRef}</label>
          <input id={`pb-ref-${reservationId}`} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <button type="button" onClick={yes} disabled={state === "saving"} className="btn-gold !px-4 !py-2.5 text-xs">
          {t.pendingYes}
        </button>
        <button type="button" onClick={no} className="text-xs text-ink/50 underline">
          {t.pendingNo}
        </button>
        {state === "error" && <span className="text-sm text-red-600">{t.error}</span>}
      </div>
    </div>
  );
}
