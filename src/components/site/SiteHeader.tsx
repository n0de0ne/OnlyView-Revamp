"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDict, localePath, type Locale } from "@/lib/i18n";

/** Apple's interruptible-spring curve, shared with the tab bar. */
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Transparent over the home hero, glass everywhere else / on scroll
  const isHome = pathname === "/" || pathname === "/fr";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const solid = scrolled || !isHome;

  const links: Array<[string, string]> = [
    [localePath(locale, "/villa"), t.nav.villa],
    [localePath(locale, "/tour"), t.nav.tour],
    [localePath(locale, "/gallery"), t.nav.gallery],
    [localePath(locale, "/rates"), t.nav.rates],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/contact"), t.nav.contact],
  ];
  /** the tab bar already carries villa / tour / gallery / rates / booking */
  const secondary: Array<[string, string]> = [
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/why-book-direct"), t.footer.whyDirect],
    [localePath(locale, "/location"), t.location.title],
    [localePath(locale, "/faq"), "FAQ"],
    [localePath(locale, "/contact"), t.nav.contact],
    [localePath(locale, "/account"), t.nav.account],
  ];

  // Language switch keeps the current page
  const pathNoLocale = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
  const frHref = pathNoLocale === "/" ? "/fr" : `/fr${pathNoLocale}`;

  return (
    <>
      {/* ── Desktop / large screens ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 hidden transition-all duration-500 xl:block ${
          solid ? "glass-dark" : "bg-gradient-to-b from-black/55 to-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <Link
            href={localePath(locale, "/")}
            className="group flex flex-col leading-none"
            aria-label="Villa ONLY VIEW — home"
          >
            <span className="font-display text-[1.35rem] tracking-[0.32em] text-white transition group-hover:text-gold">
              ONLY&nbsp;VIEW
            </span>
            <span className="mt-1 text-[0.55rem] font-medium uppercase tracking-[0.42em] text-gold">
              Saint-Barthélemy
            </span>
          </Link>

          <nav className="flex items-center gap-7" aria-label="Main">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`text-[0.72rem] font-medium uppercase tracking-[0.18em] transition hover:text-gold ${
                  pathname === href ? "text-gold" : "text-white/85"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-widest">
              <Link
                href={pathNoLocale}
                className={locale === "en" ? "text-gold" : "text-white/60 hover:text-white"}
              >
                EN
              </Link>
              <span className="text-white/30">·</span>
              <Link
                href={frHref}
                className={locale === "fr" ? "text-gold" : "text-white/60 hover:text-white"}
              >
                FR
              </Link>
            </div>
            <Link
              href={localePath(locale, "/account")}
              className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-white/85 transition hover:text-gold"
            >
              {t.nav.account}
            </Link>
            <Link href={localePath(locale, "/booking")} className="btn-gold !px-5 !py-2.5">
              {t.nav.booking}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile: floating glass bar (the tab bar carries navigation) ──
          Like an iOS 26 navigation bar it collapses to the leading edge as the
          page scrolls: the wordmark capsule shrinks to its content on the left
          and the menu sits in its own glass button on the right. */}
      <header
        className="fixed inset-x-0 top-0 z-50 xl:hidden"
        style={{ paddingTop: "max(0.6rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-3 flex items-center justify-between gap-2">
          <Link
            href={localePath(locale, "/")}
            className="glass-dark flex min-w-0 flex-col justify-center overflow-hidden rounded-full leading-none"
            aria-label="Villa ONLY VIEW"
            style={{
              flex: scrolled ? "0 1 auto" : "1 1 auto",
              height: scrolled ? "2.75rem" : "3.5rem",
              paddingInline: scrolled ? "1.1rem" : "1.25rem",
              transition: `flex 520ms ${SPRING}, height 520ms ${SPRING}, padding 520ms ${SPRING}`,
            }}
          >
            <span
              className="whitespace-nowrap font-display tracking-[0.3em] text-white"
              style={{
                fontSize: scrolled ? "0.92rem" : "1.05rem",
                transition: `font-size 520ms ${SPRING}`,
              }}
            >
              ONLY&nbsp;VIEW
            </span>
            {/* the subtitle folds away as the page scrolls, like an iOS large title */}
            <span
              className="block overflow-hidden whitespace-nowrap text-[0.45rem] font-medium uppercase tracking-[0.4em] text-gold"
              style={{
                maxHeight: scrolled ? 0 : "0.9rem",
                opacity: scrolled ? 0 : 1,
                marginTop: scrolled ? 0 : "0.125rem",
                transition: `max-height 520ms ${SPRING}, opacity 260ms ease, margin-top 520ms ${SPRING}`,
              }}
            >
              Saint-Barthélemy
            </span>
          </Link>

          <button
            className="glass-dark tap flex shrink-0 items-center justify-center rounded-full text-white"
            onClick={() => setOpen(true)}
            aria-label={t.navShort.more}
            aria-expanded={open}
            style={{
              height: scrolled ? "2.75rem" : "3.5rem",
              width: scrolled ? "2.75rem" : "3.5rem",
              transition: `height 520ms ${SPRING}, width 520ms ${SPRING}`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile sheet: everything the tab bar doesn't carry ── */}
      <div
        className={`fixed inset-0 z-[60] xl:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-night/45 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`glass absolute inset-x-2 bottom-2 rounded-[2rem] p-5 transition-all duration-400 ${
            open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />
          <nav className="grid gap-0.5" aria-label="Secondaire">
            {secondary.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`tap rounded-2xl px-4 py-3 text-[0.95rem] font-medium ${
                  pathname === href ? "bg-white/70 text-navy" : "text-ink/80 hover:bg-white/50"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-white/60 p-1 text-xs font-semibold uppercase tracking-widest">
              <Link
                href={pathNoLocale}
                className={`rounded-full px-3 py-1.5 ${
                  locale === "en" ? "bg-navy text-white" : "text-ink/60"
                }`}
              >
                EN
              </Link>
              <Link
                href={frHref}
                className={`rounded-full px-3 py-1.5 ${
                  locale === "fr" ? "bg-navy text-white" : "text-ink/60"
                }`}
              >
                FR
              </Link>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="tap rounded-full bg-ink/8 px-5 py-2.5 text-sm font-medium text-ink/70"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
