"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export interface GuestDateChange {
  status: string;
  fromStart: string;
  fromEnd: string;
  toStart: string;
  toEnd: string;
  adminNote: string | null;
}

type Preview = {
  nights: number;
  quotedTTC: number | null;
  minStayOk: boolean;
  minStayRequired: number;
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/**
 * Guest portal — ask to move the stay. The guest checks the new dates
 * (availability + estimated rent), sends the request, and sees the owner's
 * answer here; an approval comes with an amendment to sign.
 */
export function DateChangeRequest({
  reservationId,
  locale,
  t,
  start,
  end,
  latest: initial,
}: {
  reservationId: number;
  locale: "en" | "fr";
  t: Dict["account"]["dateChange"];
  start: string;
  end: string;
  /** the guest's most recent request, if any */
  latest: GuestDateChange | null;
}) {
  const [latest, setLatest] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ startDate: start, endDate: end, message: "" });
  const [preview, setPreview] = useState<{ check: Preview; current: number } | null>(null);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  const post = async (previewOnly: boolean) => {
    setBusy(previewOnly ? "check" : "send");
    setError(null);
    const res = await fetch(`/api/account/reservations/${reservationId}/date-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, message: form.message || null, preview: previewOnly }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(null);
    if (!data?.success) {
      setPreview(null);
      setError(t.errors[data?.error] ?? t.errors.generic);
      return;
    }
    if (previewOnly) setPreview({ check: data.preview, current: data.currentTTC });
    else {
      setLatest(data.change);
      setOpen(false);
      setPreview(null);
    }
  };

  const withdraw = async () => {
    const res = await fetch(`/api/account/reservations/${reservationId}/date-change`, {
      method: "DELETE",
    }).catch(() => null);
    if (res?.ok) setLatest(latest ? { ...latest, status: "cancelled" } : null);
  };

  const edit = (k: keyof typeof form, v: string) => {
    setForm({ ...form, [k]: v });
    if (k !== "message") setPreview(null);
    setError(null);
  };

  const pending = latest?.status === "pending";

  return (
    <div className="mt-5 border-t border-ink/8 pt-5">
      <div className="eyebrow !text-[0.6rem]">{t.title}</div>

      {latest && latest.status !== "cancelled" && (
        <div
          className={`mt-3 border px-4 py-3 text-sm ${
            latest.status === "pending"
              ? "border-st-option/40 bg-st-option/10"
              : latest.status === "approved"
                ? "border-st-free/40 bg-st-free/10"
                : "border-ink/10 bg-ink/[0.03]"
          }`}
        >
          {latest.status === "pending" &&
            fill(t.pending, { from: fmt(latest.toStart), to: fmt(latest.toEnd) })}
          {latest.status === "approved" &&
            fill(t.approved, {
              from: `${fmt(latest.fromStart)} → ${fmt(latest.fromEnd)}`,
              to: `${fmt(latest.toStart)} → ${fmt(latest.toEnd)}`,
            })}
          {latest.status === "rejected" &&
            fill(t.rejected, { to: `${fmt(latest.toStart)} → ${fmt(latest.toEnd)}` })}
          {latest.adminNote && latest.status !== "pending" && (
            <p className="mt-2 text-xs text-ink/70">
              <span className="font-semibold">{t.ownerNote}</span> {latest.adminNote}
            </p>
          )}
          {pending && (
            <button type="button" onClick={withdraw} className="mt-2 block text-xs text-ink/50 underline">
              {t.withdraw}
            </button>
          )}
        </div>
      )}

      {!pending &&
        (open ? (
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor={`dc-start-${reservationId}`}>{t.newArrival}</label>
                <input
                  id={`dc-start-${reservationId}`}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => edit("startDate", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`dc-end-${reservationId}`}>{t.newDeparture}</label>
                <input
                  id={`dc-end-${reservationId}`}
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(e) => edit("endDate", e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`dc-msg-${reservationId}`}>{t.message}</label>
              <textarea
                id={`dc-msg-${reservationId}`}
                rows={2}
                value={form.message}
                onChange={(e) => edit("message", e.target.value)}
              />
            </div>

            {preview && (
              <div className="space-y-1 border border-st-free/40 bg-st-free/10 px-4 py-3 text-sm">
                <p className="font-semibold">{fill(t.available, { nights: preview.check.nights })}</p>
                <p>
                  {preview.check.quotedTTC != null
                    ? fill(t.estimate, { amount: usd(preview.check.quotedTTC), current: usd(preview.current) })
                    : t.noEstimate}
                </p>
                {!preview.check.minStayOk && (
                  <p className="text-st-option">{fill(t.minStay, { n: preview.check.minStayRequired })}</p>
                )}
                <p className="text-xs text-ink/60">{t.carried}</p>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              {preview ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => post(false)}
                  className="btn-gold !px-5 !py-2.5 text-xs"
                >
                  {busy === "send" ? t.sending : t.send}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null || !form.startDate || !form.endDate}
                  onClick={() => post(true)}
                  className="btn-outline !px-5 !py-2.5 text-xs"
                >
                  {busy === "check" ? t.checking : t.check}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPreview(null);
                  setError(null);
                }}
                className="text-xs text-ink/50 underline"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-ink/55">{t.hint}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2 text-xs font-semibold uppercase tracking-widest text-gold"
            >
              {t.open}
            </button>
          </div>
        ))}
    </div>
  );
}
