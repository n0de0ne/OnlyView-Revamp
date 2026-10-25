import "server-only";
import type { Dict, Locale } from "./i18n";
import { getContent } from "./site-content";

/**
 * Guest emails, worded in Admin → Textes du site → Emails.
 *
 * A template is plain text: paragraphs separated by a blank line, **bold**,
 * and {placeholders} the code fills (the guest's name, the dates…). A
 * paragraph that is only a block placeholder ({details}, {button}, {bank}…)
 * becomes that block's HTML, or disappears when the email has none; so does
 * a paragraph left empty once filled (an optional sentence).
 */
export type EmailKey = keyof Dict["emails"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function emailButton(href: string, label: string, color = "#C9A962"): string {
  return `<p style="text-align:center;margin:24px 0;"><a href="${href}" style="background:${color};color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">${esc(label)}</a></p>`;
}

/** A grey key/value table, like the booking details. */
export function emailTable(rows: Array<[string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;font-size:14px;margin:16px 0;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;color:#64748b;">${esc(k)}</td><td style="padding:6px 10px;font-weight:600;">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;
}

/** The owner's note to the guest, as a quoted block. */
export function emailNote(note: string | null | undefined): string {
  return note?.trim()
    ? `<p style="background:#f8fafc;padding:14px 18px;border-left:3px solid #C9A962;">${esc(note.trim()).replace(/\n/g, "<br>")}</p>`
    : "";
}

/** Template text → HTML: escaped, {text} filled (twice, so a sentence chosen from the template can quote others), **bold**. */
export function renderEmailText(
  body: string,
  text: Record<string, string | number>,
  blocks: Record<string, string> = {}
): string {
  const safe = Object.fromEntries(Object.entries(text).map(([k, v]) => [k, esc(String(v))]));
  return body
    .split(/\n\s*\n/)
    .map((para) => {
      const only = para.trim().match(/^\{(\w+)\}$/);
      if (only && only[1] in blocks) return blocks[only[1]];
      const out = fill(fill(esc(para.trim()), safe), safe)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
      return out.trim() ? `<p>${out}</p>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** A template's subject, filled (plain text). */
export const renderEmailSubject = (subject: string, text: Record<string, string | number>) =>
  fill(fill(subject, text), text).replace(/\*\*/g, "");

/** The template's texts for one language (subject, body, button labels…). */
export async function emailTexts<K extends EmailKey>(key: K, locale: Locale): Promise<Dict["emails"][K]> {
  return (await getContent(locale)).emails[key];
}

/**
 * Subject and HTML of a guest email. `text` values are escaped; `blocks`
 * are trusted HTML the code builds (tables, buttons).
 */
export async function renderEmail(
  key: EmailKey,
  locale: Locale,
  text: Record<string, string | number>,
  blocks: Record<string, string> = {}
): Promise<{ subject: string; html: string }> {
  const t = (await emailTexts(key, locale)) as { subject: string; body: string };
  return { subject: renderEmailSubject(t.subject, text), html: renderEmailText(t.body, text, blocks) };
}
