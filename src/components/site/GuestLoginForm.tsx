"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

export function GuestLoginForm({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/account/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDevLink(data.devLink ?? null);
        setState("sent");
      } else setState("error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="border border-st-free/40 bg-st-free/10 p-6 text-sm">
        <p className="text-st-free">✓ {t.account.linkSent}</p>
        {devLink && (
          <p className="mt-3 break-all text-xs text-ink/60">
            {t.account.devLink}{" "}
            <a href={devLink} className="text-gold underline">
              {devLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="leading-relaxed text-ink/70">{t.account.loginText}</p>
      <div className="field">
        <label htmlFor="g-email">{t.account.emailLabel}</label>
        <input
          id="g-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>
      {state === "error" && <p className="text-sm text-red-600">{t.booking.error}</p>}
      <button type="submit" disabled={state === "sending"} className="btn-gold w-full">
        {state === "sending" ? t.booking.sending : t.account.sendLink}
      </button>
    </form>
  );
}
