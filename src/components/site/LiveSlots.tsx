"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import {
  LIVE_SLOT_PLATFORMS,
  PLATFORM_LABELS,
  prefilledBookingUrl,
  type PlatformRef,
} from "@/lib/booking-platforms";
import { savePendingBooking } from "@/lib/pending-booking";

interface Slot {
  time: string;
  bookable: boolean;
  note?: string;
}

/**
 * A restaurant's free times for the chosen day, from its online booking
 * system. Zenchef restaurants are booked without leaving the portal (their
 * widget, on /account/book); a SevenRooms time opens SevenRooms on that very
 * slot. Either way, a booking made off-site is remembered so the portal can
 * ask "Did you book it?" on return.
 */
export function LiveSlots({
  reservationId,
  placeId,
  placeName,
  bookPagePath,
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
  placeName: string;
  /** /account/book in the guest's language */
  bookPagePath: string;
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
  const zenchef = platform.platform === "zenchef";
  const sevenrooms = platform.platform === "sevenrooms";
  const remember = (at: string | null) =>
    savePendingBooking({ reservationId, placeId, name: placeName, date, time: at, guests, platform: platform.platform });
  const pick = (at: string) => {
    onPick(at);
    if (sevenrooms) {
      // straight to that slot on SevenRooms; the guest fills in their details there
      remember(at);
      window.open(prefilledBookingUrl(bookingUrl, platform, { date, guests, time: at }), "_blank", "noopener");
    }
  };
  const inApp = `${bookPagePath}?${new URLSearchParams({
    r: String(reservationId),
    p: String(placeId),
    date,
    guests: String(guests),
  })}`;

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
                    onClick={() => pick(s.time)}
                    aria-pressed={time === s.time}
                    title={s.note}
                    className={`border px-2.5 py-1 text-xs tabular-nums ${s.bookable ? "" : "border-dashed"} ${
                      time === s.time ? "border-gold bg-gold text-white" : "border-ink/20 text-ink/70 hover:border-gold"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              {sevenrooms && <p className="mt-1.5 text-[0.65rem] text-ink/45">{t.slotOpensOn.replace("{p}", name)}</p>}
              {slots.some((s) => !s.bookable) && <p className="mt-1.5 text-[0.65rem] text-ink/45">{t.liveRequestHint}</p>}
              {/* the venue's conditions ("€180 prepayment"), for the picked time or shared by all */}
              {(() => {
                const notes = [...new Set(slots.map((s) => s.note).filter(Boolean))];
                const note = slots.find((s) => s.time === time)?.note ?? (notes.length === 1 ? notes[0] : null);
                return note ? <p className="mt-1.5 text-xs text-ink/60">ⓘ {note}</p> : null;
              })()}
            </>
          )}
        </>
      )}
      {zenchef ? (
        <Link href={inApp} className="btn-gold mt-3 inline-block !px-5 !py-2.5 text-xs">
          {t.bookHere}
        </Link>
      ) : (
        <a
          href={link}
          target="_blank"
          rel="noopener"
          onClick={() => remember(time || null)}
          className="mt-2 inline-block text-xs font-semibold uppercase tracking-widest text-ink/50 hover:text-gold"
        >
          {t.bookOn.replace("{p}", name)} ↗
        </a>
      )}
    </div>
  );
}
