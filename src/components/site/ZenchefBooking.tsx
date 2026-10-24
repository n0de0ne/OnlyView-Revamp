"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { savePendingBooking } from "@/lib/pending-booking";

interface ZenchefApi {
  open?: () => void;
  openWith?: (o: { day?: string; pax?: number }) => void;
}
type BookingDetail = { bookingId?: string | number; date?: string; pax?: number; slot?: string };

/**
 * Zenchef's own booking widget (their public SDK), opened on our page for one
 * restaurant. When the guest completes the booking the widget fires
 * zc-widget-booking-completed, and we record it on the stay.
 */
export function ZenchefBooking({
  reservationId,
  placeId,
  name,
  rid,
  date,
  guests,
  locale,
  fallbackUrl,
  backHref,
  t,
}: {
  reservationId: number;
  placeId: number;
  name: string;
  rid: string;
  date: string;
  guests: number;
  locale: "en" | "fr";
  fallbackUrl: string;
  backHref: string;
  t: Dict["account"]["concierge"];
}) {
  const [state, setState] = useState<"loading" | "open" | "closed" | "saving" | "done" | "failed">("loading");
  const [booked, setBooked] = useState<{ time: string | null; ref: string | null } | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    const w = window as unknown as { ZenchefWidget?: ZenchefApi };
    const open = () => {
      const zc = w.ZenchefWidget;
      if (!zc) return false;
      if (zc.openWith) zc.openWith({ day: date, pax: guests });
      else zc.open?.();
      setState("open");
      return true;
    };

    const onCompleted = async (e: Event) => {
      if (saved.current) return;
      saved.current = true;
      const d = ((e as CustomEvent<BookingDetail>).detail ?? {}) as BookingDetail;
      const time = typeof d.slot === "string" && /^\d{1,2}:\d{2}/.test(d.slot) ? d.slot.slice(0, 5).padStart(5, "0") : null;
      const ref = d.bookingId != null ? String(d.bookingId) : null;
      setBooked({ time, ref });
      setState("saving");
      const res = await fetch(`/api/account/reservations/${reservationId}/restaurant-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          date: typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(d.date) ? d.date.slice(0, 10) : date,
          time,
          guests: typeof d.pax === "number" && d.pax > 0 ? d.pax : guests,
          platform: "zenchef",
          reference: ref,
          source: "widget",
        }),
      }).catch(() => null);
      // booked on Zenchef either way; if we couldn't record it, the portal asks on return
      if (!res?.ok) savePendingBooking({ reservationId, placeId, name, date, time, guests, platform: "zenchef" });
      setState("done");
    };
    const onClosed = () => setState((s) => (s === "open" ? "closed" : s));
    window.addEventListener("zc-widget-booking-completed", onCompleted);
    window.addEventListener("zc-widget-closed", onClosed);

    // one restaurant per page: the SDK reads its config element once, at load
    if (!document.getElementById("zenchef-sdk")) {
      const cfg = document.createElement("div");
      cfg.className = "zc-widget-config";
      cfg.dataset.restaurant = rid;
      cfg.dataset.lang = locale;
      cfg.dataset.disableGtm = "true";
      cfg.dataset.disableGa4 = "true";
      document.body.appendChild(cfg);
      const s = document.createElement("script");
      s.id = "zenchef-sdk";
      s.async = true;
      s.src = "https://sdk.zenchef.com/v1/sdk.min.js";
      document.body.appendChild(s);
    }
    // the SDK takes a moment to set itself up; give up after ~10 s
    let tries = 0;
    const timer = setInterval(() => {
      if (open() || ++tries > 40) {
        clearInterval(timer);
        if (tries > 40) setState("failed");
      }
    }, 250);

    return () => {
      clearInterval(timer);
      window.removeEventListener("zc-widget-booking-completed", onCompleted);
      window.removeEventListener("zc-widget-closed", onClosed);
    };
  }, [reservationId, placeId, name, rid, date, guests, locale]);

  const reopen = () => {
    const zc = (window as unknown as { ZenchefWidget?: ZenchefApi }).ZenchefWidget;
    if (zc?.openWith) zc.openWith({ day: date, pax: guests });
    else zc?.open?.();
    setState("open");
  };

  return (
    <div className="border border-ink/10 bg-white p-6 text-sm">
      <div className="eyebrow !text-[0.6rem]">{t.inAppTitle}</div>
      <h2 className="mt-2 font-display text-2xl">{name}</h2>
      <p className="mt-1 text-ink/60">
        {date} · {guests} {t.guests.toLowerCase()}
      </p>

      <div className="mt-5" role="status">
        {state === "loading" && <p className="text-ink/55">{t.inAppLoading}</p>}
        {state === "open" && <p className="text-ink/55">{t.inAppOpen}</p>}
        {state === "saving" && <p className="text-ink/55">{t.inAppSaving}</p>}
        {state === "done" && (
          <p className="text-st-free">
            ✓ {t.inAppDone}
            {booked?.time ? ` — ${booked.time}` : ""}
            {booked?.ref ? ` (#${booked.ref})` : ""}
          </p>
        )}
        {state === "closed" && (
          <button type="button" onClick={reopen} className="btn-gold !px-5 !py-2.5 text-xs">
            {t.inAppReopen}
          </button>
        )}
        {state === "failed" && (
          <p className="text-ink/60">
            {t.inAppFailed}{" "}
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener"
              className="text-gold underline"
              onClick={() =>
                savePendingBooking({ reservationId, placeId, name, date, time: null, guests, platform: "zenchef" })
              }
            >
              {t.bookOn.replace("{p}", "Zenchef")} ↗
            </a>
          </p>
        )}
      </div>

      <Link href={backHref} className="mt-6 inline-block text-xs font-semibold uppercase tracking-widest text-gold">
        ← {t.backToStay}
      </Link>
    </div>
  );
}
