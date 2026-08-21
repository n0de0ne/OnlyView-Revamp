"use client";

import { useCallback, useEffect, useState } from "react";
import { getDict, tpl, type Locale } from "@/lib/i18n";
import { usd } from "@/lib/money";
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
  const [bedrooms, setBedrooms] = useState(4);
  const [guests, setGuests] = useState(8);
  const [promoCode, setPromoCode] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

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
      <div className="mx-auto max-w-xl border border-gold/40 bg-white p-10 text-center">
        <div className="mb-4 text-4xl" aria-hidden>
          🌅
        </div>
        <h2 className="font-display text-3xl text-ink">{t.booking.successTitle}</h2>
        <p className="mt-4 leading-relaxed text-ink/70">{t.booking.successText}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
      {/* Left: calendar + selectors */}
      <div className="border border-ink/10 bg-white p-6 md:p-8">
        <h2 className="mb-6 font-display text-2xl">{t.booking.calTitle}</h2>
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

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field mt-4 max-w-[200px]">
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

      {/* Right: quote + request form */}
      <div className="space-y-6">
        <div className="border border-ink/10 bg-night p-6 text-white md:p-8">
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
        <form onSubmit={submit} className="border border-ink/10 bg-white p-6 md:p-8">
          <h2 className="mb-5 font-display text-2xl">{t.booking.formTitle}</h2>
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
    </div>
  );
}
