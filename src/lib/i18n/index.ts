import { en, type Dict } from "./en";
import { fr } from "./fr";

export type Locale = "en" | "fr";
export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";

const dicts: Record<Locale, Dict> = { en, fr };

export function getDict(locale: string): Dict {
  return dicts[(locale as Locale) in dicts ? (locale as Locale) : DEFAULT_LOCALE];
}

export function isLocale(v: string): v is Locale {
  return LOCALES.includes(v as Locale);
}

/** Path helper: EN lives at /, FR at /fr. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") return clean === "/" ? "/" : clean;
  return clean === "/" ? "/fr" : `/fr${clean}`;
}

/** Simple {placeholder} interpolation. */
export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export type { Dict };
