"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDict, tpl, type Locale } from "@/lib/i18n";
import { usd } from "@/lib/money";
import { maxGuestsFor } from "@/lib/site-facts";
import { AvailabilityCalendar, type BookedRange } from "./AvailabilityCalendar";

interface QuoteResponse {
  success: boolean;
  available: boolean;
  quote: {
    nights: number;
    minStayOk: boolean;
    minStayRequired: number;
    seasonSummary: string;
    lines: Array<{ label: string; labelFr: string; nights: number; amount: number }>;
    baseBeforeOffers: number;
    promoName: string | null;
    promoDiscount: number;
    subtotalHT: number;
    taxAmount: number;
    totalTTC: number;
    depositAmount: number;
    balanceAmount: number;
  };
  loyaltyPoints: number;
}

export function BookingWidget({
  locale,
  initialBookings,
}: {
  locale: Locale;
  initialBookings: BookedRange[];
}) {
  const t = getDict(locale);
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [bedrooms, setBedroomsRaw] = useState(4);
  const [guests, setGuests] = useState(8);
  // two guests per bedroom: fewer bedrooms bring the party size down with them
  const maxGuests = maxGuestsFor(bedrooms);
  const setBedrooms = (n: number) => {
    setBedroomsRaw(n);
    setGuests((g) => Math.min(g, maxGuestsFor(n)));
  };
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  // phone layout: party steppers, promo field and the request sheet start tucked away
  const [partyOpen, setPartyOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const fetchQuote = useCallback(async () => {
    if (!range.start || !range.end) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: range.start,
          endDate: range.end,
          bedrooms,
          promoCode: promoCode || null,
        }),
      });
      const data = (await res.json()) as QuoteResponse;
      setQuote(res.ok && data.success ? data : null);
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [range.start, range.end, bedrooms, promoCode]);

  useEffect(() => {
    const id = setTimeout(fetchQuote, 250);
    return () => clearTimeout(id);
  }, [fetchQuote]);

  const bothDates = Boolean(range.start && range.end);

  // the sheet only makes sense with a full range
  useEffect(() => {
    if (!bothDates) setSheetOpen(false);
  }, [bothDates]);

  // while the sheet is up the page behind it stays put; Escape closes it
  useEffect(() => {
    if (!sheetOpen) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (submitState === "done") topRef.current?.scrollIntoView({ block: "start" });
  }, [submitState]);

  const shortDate = (d: string, withDay = false) =>
    new Date(d + "T00:00:00").toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      ...(withDay ? { weekday: "short" as const } : {}),
      day: "numeric",
      month: "short",
    });
  const nightCount =
    range.start && range.end
      ? Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000)
      : 0;

  let barTitle = t.booking.addDates;
  let barSub = t.booking.pickArrival;
  if (range.start && !range.end) {
    barTitle = `${shortDate(range.start)} → …`;
    barSub = t.booking.pickDeparture;
  } else if (range.start && range.end) {
    barTitle = quote
      ? quote.available
        ? tpl(t.booking.totalShort, { amount: usd(quote.quote.totalTTC) })
        : t.booking.unavailable
      : quoteLoading
        ? t.common.loading
        : `${shortDate(range.start)} → ${shortDate(range.end)}`;
    barSub = `${shortDate(range.start)} → ${shortDate(range.end)} · ${nightCount} ${t.booking.nights}`;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!range.start || !range.end) return;
    setSubmitState("sending");
    try {
      const res = await fetch("/api/booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: range.start,
          endDate: range.end,
          bedrooms,
          guests,
          promoCode: promoCode || null,
          locale,
          quote: quote?.quote ?? null,
          ...form,
          phone: form.phone || null,
          message: form.message || null,
        }),
      });
      setSubmitState(res.ok ? "done" : "error");
    } catch {
      setSubmitState("error");
    }
  };

  if (submitState === "done") {
    return (
      <div ref={topRef} className="mx-auto max-w-xl scroll-mt-24 border border-gold/40 bg-white p-10 text-center">
        <div className="mb-4 text-4xl" aria-hidden>
          🌅
        </div>
        <h2 className="font-display text-3xl text-ink">{t.booking.successTitle}</h2>
        <p className="mt-4 leading-relaxed text-ink/70">{t.booking.successText}</p>
      </div>
    );
  }

  const stepBtn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 bg-white text-lg text-ink transition hover:border-gold disabled:opacity-30";

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-10 lg:grid-cols-[1.15fr_1fr]">
      {/* Left: calendar + selectors */}
      <div className="border border-ink/10 bg-white p-4 md:p-8">
        <h2 className="mb-6 hidden font-display text-2xl lg:block">{t.booking.calTitle}</h2>

        {/* Phone: the picked dates read back above the calendar */}
        <div className="mb-4 grid grid-cols-2 border border-ink/15 lg:hidden">
          {([
            ["start", t.booking.checkin, range.start, () => setRange({ start: null, end: null })],
            ["end", t.booking.checkout, range.end, () => range.start && setRange({ start: range.start, end: null })],
          ] as const).map(([key, label, value, onClick]) => {
            const picking = key === "start" ? !range.start || bothDates : Boolean(range.start && !range.end);
            return (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className={`px-3.5 py-2.5 text-left transition ${key === "start" ? "border-r border-ink/10" : ""} ${
                  picking ? "shadow-[inset_0_0_0_2px_var(--color-gold)]" : ""
                }`}
              >
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/60">
                  {label}
                </span>
                <span className={`mt-0.5 block text-[0.95rem] ${value ? "font-medium text-ink" : "text-ink/45"}`}>
                  {value ? shortDate(value, true) : t.booking.addDate}
                </span>
              </button>
            );
          })}
        </div>

        <AvailabilityCalendar
          bookings={initialBookings}
          months={2}
          locale={locale}
          value={range}
          onChange={setRange}
          legend={{
            free: t.booking.legendFree,
            booked: t.booking.legendBooked,
            option: t.booking.legendOption,
          }}
        />

        <div className="mt-8 hidden grid-cols-4 gap-4 lg:grid">
          <div className="field">
            <label htmlFor="bk-start">{t.booking.checkin}</label>
            <input
              id="bk-start"
              type="date"
              value={range.start ?? ""}
              onChange={(e) => setRange({ start: e.target.value || null, end: range.end })}
            />
          </div>
          <div className="field">
            <label htmlFor="bk-end">{t.booking.checkout}</label>
            <input
              id="bk-end"
              type="date"
              value={range.end ?? ""}
              min={range.start ?? undefined}
              onChange={(e) => setRange({ start: range.start, end: e.target.value || null })}
            />
          </div>
          <div className="field">
            <label htmlFor="bk-bed">{t.booking.bedroomsLabel}</label>
            <select
              id="bk-bed"
              value={bedrooms}
              onChange={(e) => setBedrooms(parseInt(e.target.value))}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bk-guests">{t.booking.guestsLabel}</label>
            <select
              id="bk-guests"
              value={guests}
              onChange={(e) => setGuests(parseInt(e.target.value))}
            >
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Phone: guests and bedrooms on one line, steppers on demand */}
        <div className="mt-4 border border-ink/10 lg:hidden">
          <div className="flex min-h-[3.25rem] items-center justify-between pl-3.5 pr-1">
            <p className="text-sm">
              <span className="font-semibold">{tpl(t.booking.guestsCount, { n: guests })}</span>
              {" · "}
              {tpl(t.booking.bedroomsCount, { n: bedrooms })}
            </p>
            <button
              type="button"
              onClick={() => setPartyOpen((o) => !o)}
              aria-expanded={partyOpen}
              className="h-11 px-3 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-gold-dark"
            >
              {partyOpen ? t.booking.done : t.booking.edit}
            </button>
          </div>
          {partyOpen && (
            <div className="space-y-1 border-t border-ink/10 px-3.5 py-2">
              {([
                [t.booking.guestsLabel, guests, setGuests, 1, maxGuests],
                [t.booking.bedroomsLabel, bedrooms, setBedrooms, 2, 4],
              ] as const).map(([label, value, set, min, max]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={stepBtn}
                      disabled={value <= min}
                      onClick={() => set(Math.max(min, value - 1))}
                      aria-label={`${t.booking.fewer} — ${label}`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold" aria-live="polite">
                      {value}
                    </span>
                    <button
                      type="button"
                      className={stepBtn}
                      disabled={value >= max}
                      onClick={() => set(Math.min(max, value + 1))}
                      aria-label={`${t.booking.more} — ${label}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-2 text-[0.78rem] text-ink/55">{t.booking.guestsRule}</p>

        {/* promo: always shown from lg up, behind a link on a phone */}
        {!promoOpen && (
          <button
            type="button"
            onClick={() => setPromoOpen(true)}
            className="mt-2 h-11 text-[0.82rem] text-gold-dark underline underline-offset-4 lg:hidden"
          >
            {t.booking.promoAsk}
          </button>
        )}
        <div className={`field mt-4 max-w-[200px] ${promoOpen ? "" : "hidden lg:block"}`}>
          <label htmlFor="bk-promo">{t.booking.promoLabel}</label>
          <input
            id="bk-promo"
            type="text"
            placeholder={t.booking.promoPlaceholder}
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
          />
        </div>
      </div>

      {/* Right: quote + request form — a bottom sheet on a phone, opened from the bar */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[65] bg-night/45 lg:hidden"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        data-lenis-prevent
        role={sheetOpen ? "dialog" : undefined}
        aria-modal={sheetOpen || undefined}
        aria-label={sheetOpen ? t.booking.formTitle : undefined}
        className={`space-y-6 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[70] max-lg:max-h-[88dvh] max-lg:space-y-4 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:bg-sand max-lg:px-4 max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:shadow-2xl ${
          sheetOpen ? "" : "max-lg:hidden"
        }`}
      >
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-sand pl-4 pr-1 pt-2 lg:hidden">
          <span className="mx-auto h-1 w-10 translate-x-5 rounded-full bg-ink/20" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="flex h-11 w-11 items-center justify-center text-2xl leading-none text-ink/70"
            aria-label={t.booking.close}
          >
            ×
          </button>
        </div>
        <div className="border border-ink/10 bg-night p-5 text-white md:p-8">
          <h2 className="mb-5 font-display text-2xl">{t.booking.quoteTitle}</h2>
          {!range.start || !range.end ? (
            <p className="text-sm text-white/60">
              {t.booking.checkin} + {t.booking.checkout} →{" "}
              {locale === "fr" ? "devis instantané" : "instant quote"}
            </p>
          ) : quoteLoading && !quote ? (
            <p className="text-sm text-white/60">{t.common.loading}</p>
          ) : quote ? (
            <div className={quoteLoading ? "opacity-60 transition" : "transition"}>
              {!quote.available && (
                <p className="mb-4 border border-st-option/60 bg-st-option/15 px-4 py-3 text-sm text-st-option">
                  {t.booking.unavailable}
                </p>
              )}
              {quote.available && (
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-st-free">
                  ✓ {t.booking.available}
                </p>
              )}
              {!quote.quote.minStayOk && (
                <p className="mb-4 border border-st-option/60 bg-st-option/15 px-4 py-3 text-sm text-st-option">
                  {tpl(t.booking.minStayWarning, { n: quote.quote.minStayRequired })}
                </p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>
                    {quote.quote.nights} {t.booking.nights} · {quote.quote.seasonSummary}
                  </span>
                </div>
                {quote.quote.lines.map((line, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-white/80">
                      {locale === "fr" ? line.labelFr : line.label}
                    </span>
                    <span>{usd(line.amount)}</span>
                  </div>
                ))}
                {quote.quote.promoDiscount > 0 && (
                  <div className="flex justify-between text-gold">
                    <span>
                      {t.booking.promoApplied} — {quote.quote.promoName}
                    </span>
                    <span>-{usd(quote.quote.promoDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/15 pt-2">
                  <span>{t.booking.rentalRate}</span>
                  <span>{usd(quote.quote.subtotalHT)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>{t.booking.tax}</span>
                  <span>+{usd(quote.quote.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-gold/40 pt-3 font-display text-xl text-gold">
                  <span>{t.booking.total}</span>
                  <span>{usd(quote.quote.totalTTC)}</span>
                </div>
                <div className="flex justify-between pt-2 text-xs text-white/55">
                  <span>{t.booking.deposit}</span>
                  <span>{usd(quote.quote.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/55">
                  <span>{t.booking.balance}</span>
                  <span>{usd(quote.quote.balanceAmount)}</span>
                </div>
                {quote.loyaltyPoints > 0 && (
                  <p className="mt-3 border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                    ✦ {tpl(t.booking.loyaltyEarn, { points: quote.loyaltyPoints })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">{t.booking.error}</p>
          )}
        </div>

        {/* Request form */}
        <form onSubmit={submit} className="border border-ink/10 bg-white p-5 md:p-8">
          <h2 className="mb-5 font-display text-2xl">{t.booking.formTitle}</h2>
          {/* the hero drops this line on a phone; it reassures best right here */}
          <p className="-mt-2 mb-5 text-sm leading-relaxed text-ink/65 lg:hidden">{t.booking.intro}</p>
          <div className="space-y-4">
            <div className="field">
              <label htmlFor="bk-name">{t.booking.name} *</label>
              <input
                id="bk-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="bk-email">{t.booking.email} *</label>
                <input
                  id="bk-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="bk-phone">{t.booking.phone}</label>
                <input
                  id="bk-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="bk-msg">{t.booking.message}</label>
              <textarea
                id="bk-msg"
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
          </div>
          {submitState === "error" && (
            <p className="mt-4 text-sm text-red-600">{t.booking.error}</p>
          )}
          <button
            type="submit"
            disabled={!range.start || !range.end || submitState === "sending"}
            className="btn-gold mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitState === "sending" ? t.booking.sending : t.booking.submit}
          </button>
        </form>
      </div>

      {/* Phone: the booking bar replaces the tab bar on this page */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-ink/10 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(16,24,32,0.06)] backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="truncate text-[0.95rem] font-semibold text-ink">{barTitle}</p>
            <p className="truncate text-xs text-ink/65">{barSub}</p>
          </div>
          <button
            type="button"
            disabled={!bothDates}
            onClick={() => setSheetOpen(true)}
            className="btn-gold shrink-0 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {bothDates ? t.booking.requestBtn : t.booking.quoteBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
