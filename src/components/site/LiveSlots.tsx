"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import {
  LIVE_SLOT_PLATFORMS,
  PLATFORM_LABELS,
  prefilledBookingUrl,
  type PlatformRef,
} from "@/lib/booking-platforms";

interface Slot {
  time: string;
  bookable: boolean;
}

/**
 * A restaurant's free times for the chosen day, from its online booking
 * system (SevenRooms, Zenchef). Picking one fills the request's time; the
 * guest can also book straight on the platform, pre-filled.
 */
export function LiveSlots({
  reservationId,
  placeId,
  bookingUrl,
  platform,
  date,
  guests,
  time,
  onPick,
  t,
}: {
  reservationId: number;
  placeId: number;
  bookingUrl: string;
  platform: PlatformRef;
  date: string;
  guests: number;
  time: string;
  onPick: (time: string) => void;
  t: Dict["account"]["concierge"];
}) {
  const live = LIVE_SLOT_PLATFORMS.includes(platform.platform);
  const [slots, setSlots] = useState<Slot[] | null | "loading">("loading");

  useEffect(() => {
    if (!live || !date) return;
    setSlots("loading");
    const ctl = new AbortController();
    // wait for the guest to stop typing a party size
    const id = setTimeout(() => {
      const q = new URLSearchParams({ place: String(placeId), date, guests: String(guests) });
      fetch(`/api/account/reservations/${reservationId}/slots?${q}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setSlots(d?.success ? d.slots : null))
        .catch((e) => e.name !== "AbortError" && setSlots(null));
    }, 350);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [live, reservationId, placeId, date, guests]);

  const name = PLATFORM_LABELS[platform.platform];
  const link = prefilledBookingUrl(bookingUrl, platform, { date, guests, time });

  return (
    <div className="sm:col-span-3">
      {live && (
        <>
          <div className="eyebrow !text-[0.6rem]">{t.liveTitle.replace("{p}", name)}</div>
          {slots === "loading" ? (
            <p className="mt-2 text-xs text-ink/50">{t.liveLoading}</p>
          ) : slots === null ? (
            <p className="mt-2 text-xs text-ink/50">{t.liveUnavailable}</p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-xs text-ink/50">{t.liveNone}</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    onClick={() => onPick(s.time)}
                    aria-pressed={time === s.time}
                    className={`border px-2.5 py-1 text-xs tabular-nums ${s.bookable ? "" : "border-dashed"} ${
                      time === s.time ? "border-gold bg-gold text-white" : "border-ink/20 text-ink/70 hover:border-gold"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              {slots.some((s) => !s.bookable) && <p className="mt-1.5 text-[0.65rem] text-ink/45">{t.liveRequestHint}</p>}
            </>
          )}
        </>
      )}
      <a
        href={link}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-block text-xs font-semibold uppercase tracking-widest text-ink/50 hover:text-gold"
      >
        {t.bookOn.replace("{p}", name)} ↗
      </a>
    </div>
  );
}
