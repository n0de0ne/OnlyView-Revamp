"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The site's own audience measurement (Admin → Analytique). No third-party
 * script: page views, the time a page is actually looked at, scroll depth and
 * a few actions go to /api/analytics on this server.
 *
 * Actions are picked up without wiring each component: links to WhatsApp,
 * email, phone or other sites, and any element with `data-track="name"`.
 * Components can also call `track()` directly.
 */

const ENDPOINT = "/api/analytics";
/** stop counting time after this long without any input */
const IDLE_MS = 120_000;

type Props = Record<string, string | number | boolean | null>;

const optedOut = () => typeof document !== "undefined" && /(?:^|;\s*)ov_optout=1/.test(document.cookie);

function beacon(body: object) {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([data], { type: "text/plain" }))) return;
  } catch {}
  fetch(ENDPOINT, { method: "POST", body: data, keepalive: true, credentials: "same-origin" }).catch(() => {});
}

export function track(name: string, props?: Props) {
  if (optedOut()) return;
  beacon({ t: "ev", n: name, u: location.pathname, d: props ?? null });
}

export function Analytics() {
  const pathname = usePathname();
  const state = useRef({
    pv: 0,
    first: true,
    engagedMs: 0,
    visibleSince: 0,
    lastInput: 0,
    scroll: 0,
    sent: { e: -1, s: -1 },
  });

  // time on page, scroll depth and the hand-off of the numbers when leaving
  useEffect(() => {
    const st = state.current;
    const now = () => performance.now();
    const visible = () => document.visibilityState === "visible";
    const settle = () => {
      if (st.visibleSince) {
        const t = now();
        const until = Math.min(t, st.lastInput + IDLE_MS);
        if (until > st.visibleSince) st.engagedMs += until - st.visibleSince;
        st.visibleSince = visible() && t - st.lastInput < IDLE_MS ? t : 0;
      }
    };
    const onInput = () => {
      const t = now();
      if (!st.visibleSince && visible()) st.visibleSince = t;
      else if (st.visibleSince && t - st.lastInput >= IDLE_MS) {
        settle();
        st.visibleSince = t;
      }
      st.lastInput = t;
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max <= 0 ? 100 : Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
      if (pct > st.scroll) st.scroll = Math.min(100, pct);
      onInput();
    };
    const flush = () => {
      if (!st.pv) return;
      settle();
      const e = Math.round(st.engagedMs / 1000);
      if (e === st.sent.e && st.scroll === st.sent.s) return;
      st.sent = { e, s: st.scroll };
      beacon({ t: "en", pv: st.pv, e, s: st.scroll });
    };
    const onVisibility = () => {
      if (visible()) {
        st.lastInput = now();
        st.visibleSince = now();
      } else flush();
    };
    (window as unknown as { __ovFlush?: () => void }).__ovFlush = flush;

    const opts = { passive: true } as const;
    window.addEventListener("scroll", onScroll, opts);
    for (const ev of ["pointerdown", "keydown", "pointermove", "touchstart", "wheel"]) window.addEventListener(ev, onInput, opts);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    const timer = window.setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      for (const ev of ["pointerdown", "keydown", "pointermove", "touchstart", "wheel"]) window.removeEventListener(ev, onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.clearInterval(timer);
    };
  }, []);

  // one page view per route
  useEffect(() => {
    if (optedOut()) return;
    const st = state.current;
    (window as unknown as { __ovFlush?: () => void }).__ovFlush?.();
    st.pv = 0;
    st.engagedMs = 0;
    st.scroll = 0;
    st.sent = { e: -1, s: -1 };
    st.lastInput = performance.now();
    st.visibleSince = document.visibilityState === "visible" ? performance.now() : 0;
    const referrer = st.first ? document.referrer || null : null;
    st.first = false;
    // let the page set its title first
    const id = window.setTimeout(() => {
      fetch(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          t: "pv",
          u: location.pathname + location.search,
          r: referrer,
          ti: document.title,
          la: navigator.language,
          sw: window.screen?.width ?? null,
          to: navigator.maxTouchPoints > 1,
        }),
      })
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d: { pv?: number } | null) => {
          if (d?.pv) st.pv = d.pv;
        })
        .catch(() => {});
    }, 50);
    return () => window.clearTimeout(id);
  }, [pathname]);

  // contact links, outbound links and data-track elements
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("a, button, [data-track]");
      if (!el) return;
      const named = el.closest("[data-track]")?.getAttribute("data-track");
      if (named) {
        track(named, { label: (el.textContent ?? "").trim().slice(0, 80) || null });
        return;
      }
      if (el.tagName !== "A") return;
      const href = (el as HTMLAnchorElement).href;
      if (!href) return;
      if (href.startsWith("tel:")) return track("click_phone");
      if (href.startsWith("mailto:")) return track("click_email");
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        return;
      }
      if (/(^|\.)wa\.me$|whatsapp\.com$/.test(url.hostname)) return track("click_whatsapp");
      if (url.host !== location.host && /^https?:$/.test(url.protocol)) {
        track("outbound", { host: url.hostname.replace(/^www\./, ""), url: href.slice(0, 300) });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
