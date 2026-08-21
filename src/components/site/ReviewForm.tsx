"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

export function ReviewForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({ name: "", country: "", rating: 5, message: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language: locale }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="border border-st-free/40 bg-st-free/10 px-5 py-4 text-sm text-st-free">
        ✓ {t.reviews.thanks}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-ink/10 bg-white p-7">
      <h2 className="font-display text-2xl">{t.reviews.writeTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="r-name">{t.reviews.name} *</label>
          <input
            id="r-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="r-country">{t.reviews.country}</label>
          <input
            id="r-country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label>{t.reviews.rating}</label>
        <div className="flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm({ ...form, rating: n })}
              aria-label={`${n}/5`}
              className={n <= form.rating ? "text-gold" : "text-ink/20"}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="r-msg">{t.reviews.message} *</label>
        <textarea
          id="r-msg"
          rows={4}
          required
          minLength={10}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {state === "error" && <p className="text-sm text-red-600">{t.booking.error}</p>}
      <button type="submit" disabled={state === "sending"} className="btn-gold">
        {state === "sending" ? t.booking.sending : t.reviews.submit}
      </button>
    </form>
  );
}
