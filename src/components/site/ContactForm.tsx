"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

export function ContactForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="border border-st-free/40 bg-st-free/10 px-5 py-4 text-sm text-st-free">
        ✓ {t.contact.sent}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="c-name">{t.contact.name} *</label>
          <input
            id="c-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="c-email">{t.contact.email} *</label>
          <input
            id="c-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-msg">{t.contact.message} *</label>
        <textarea
          id="c-msg"
          rows={5}
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {state === "error" && <p className="text-sm text-red-600">{t.booking.error}</p>}
      <button type="submit" disabled={state === "sending"} className="btn-gold">
        {state === "sending" ? t.booking.sending : t.contact.send}
      </button>
    </form>
  );
}
