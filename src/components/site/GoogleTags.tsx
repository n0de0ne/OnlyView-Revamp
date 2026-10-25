"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n";
import type { GoogleTagsConfig } from "@/lib/google-tags";

/**
 * Google Analytics 4 / Google Ads, behind a consent banner (CNIL): nothing
 * from Google loads until the visitor clicks "Accept", and the choice is kept
 * 6 months. Consent Mode v2 signals go with every load, which Google Ads
 * needs in the EEA for conversions and audiences.
 *
 * The site's own measurement (Analytics.tsx) is exempt and keeps running
 * whatever the choice. Its events are forwarded here by track().
 */

const CONSENT_COOKIE = "ov_consent";
const CONSENT_MAX_AGE = 182 * 86400;
/** "Cookies" links elsewhere on the site reopen the banner with this event */
const OPEN_EVENT = "ov:consent-open";
const READY_EVENT = "ov:consent-ready";

type Gtag = (...args: unknown[]) => void;
type Win = Window & { dataLayer?: unknown[]; gtag?: Gtag; __ovGoogle?: GoogleTagsConfig };

const readConsent = (): "1" | "0" | null => {
  const m = document.cookie.match(/(?:^|;\s*)ov_consent=([01])/);
  return m ? (m[1] as "1" | "0") : null;
};

const writeConsent = (v: "1" | "0") => {
  document.cookie = `${CONSENT_COOKIE}=${v}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
};

const GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
};
const DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};

function loadGoogle(config: GoogleTagsConfig) {
  const w = window as Win;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  // gtag.js reads the Arguments object, not an array
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("consent", "default", DENIED);
  w.gtag("consent", "update", GRANTED);
  w.gtag("js", new Date());
  // later page changes are counted by GA4's enhanced measurement (history events)
  if (config.ga) w.gtag("config", config.ga);
  if (config.ads) w.gtag("config", config.ads);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent((config.ga ?? config.ads)!)}`;
  document.head.appendChild(s);
}

/** Withdrawn consent: tell Google, drop its cookies, and reload without it. */
function unloadGoogle() {
  const w = window as Win;
  w.gtag?.("consent", "update", DENIED);
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!/^(_ga|_gid|_gat|_gcl_)/.test(name)) continue;
    for (const d of domains) document.cookie = `${name}=; path=/; max-age=0${d ? `; domain=${d}` : ""}`;
  }
  if (w.gtag) location.reload();
}

type Params = Record<string, string | number | boolean | null>;

/**
 * Sends a site event to GA4 and, for the ones set up in Réglages, the matching
 * Google Ads conversion. Resolves once Google has it (or after 1 s), so a page
 * about to reload can wait; resolves at once when Google isn't loaded.
 */
export function googleEvent(name: string, params?: Params): Promise<void> {
  const w = window as Win;
  const config = w.__ovGoogle;
  if (!w.gtag || !config) return Promise.resolve();
  const value = typeof params?.value === "number" ? params.value : undefined;
  const money = value != null ? { value, currency: typeof params?.currency === "string" ? params.currency : "USD" } : {};
  return new Promise((resolve) => {
    const done = () => resolve();
    window.setTimeout(done, 1000);
    const sends: string[] = [];
    if (config.ga) {
      sends.push("ga");
      w.gtag!("event", name, { ...params, ...money, event_callback: done });
    }
    const label = config.labels[name as keyof GoogleTagsConfig["labels"]];
    if (config.ads && label) {
      sends.push("ads");
      w.gtag!("event", "conversion", { send_to: `${config.ads}/${label}`, ...money, event_callback: done });
    }
    if (!sends.length) done();
  });
}

/** "Cookies" link for the footer and the privacy page; hidden while Google isn't set up. */
export function CookieSettingsLink({ label, className }: { label: string; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(Boolean((window as Win).__ovGoogle));
    check();
    window.addEventListener(READY_EVENT, check);
    return () => window.removeEventListener(READY_EVENT, check);
  }, []);
  if (!show) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {label}
    </button>
  );
}

export function GoogleTags({ locale }: { locale: Locale }) {
  const [config, setConfig] = useState<GoogleTagsConfig | null>(null);
  const [open, setOpen] = useState(false);
  const fr = locale === "fr";

  useEffect(() => {
    let alive = true;
    fetch("/api/analytics/google", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<GoogleTagsConfig>) : null))
      .then((c) => {
        if (!alive || !c || (!c.ga && !c.ads)) return;
        (window as Win).__ovGoogle = c;
        setConfig(c);
        window.dispatchEvent(new Event(READY_EVENT));
        const consent = readConsent();
        if (consent === "1") loadGoogle(c);
        else if (consent === null) setOpen(true);
      })
      .catch(() => {});
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      alive = false;
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  if (!config || !open) return null;

  const choose = (accept: boolean) => {
    writeConsent(accept ? "1" : "0");
    setOpen(false);
    if (accept) loadGoogle(config);
    else unloadGoogle();
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookies"
      // above the mobile tab bar; bottom-left corner on a desktop
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md border border-ink/10 bg-white p-5 text-ink shadow-[0_18px_50px_-12px_rgba(12,20,27,0.35)] sm:inset-x-auto sm:left-5 xl:bottom-5"
    >
      <p className="text-sm leading-relaxed text-ink/80">
        {fr
          ? "Avec votre accord, nous utilisons Google Analytics et Google Ads pour mesurer l'efficacité de nos annonces et vous proposer la villa sur Google. Vous pouvez changer d'avis à tout moment."
          : "With your consent, we use Google Analytics and Google Ads to measure how our ads perform and show you the villa on Google. You can change your mind at any time."}{" "}
        <Link href={localePath(locale, "/privacy")} className="underline underline-offset-2 hover:text-gold">
          {fr ? "En savoir plus" : "Learn more"}
        </Link>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => choose(false)}
          className="border border-ink/25 px-4 py-2.5 text-sm text-ink transition hover:border-ink"
        >
          {fr ? "Refuser" : "Decline"}
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className="border border-ink bg-ink px-4 py-2.5 text-sm text-white transition hover:bg-ink/85"
        >
          {fr ? "Accepter" : "Accept"}
        </button>
      </div>
    </div>
  );
}
