"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { getDict, localePath, type Locale } from "@/lib/i18n";

/** Apple's interruptible-spring curve, shared with the tab bar. */
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Pages that open on a dark picture: the header starts transparent with
 * white lettering there. Everywhere else the pages open on warm paper and
 * the header is ink on paper from the first pixel.
 */
const DARK_TOP = /^\/(fr\/?)?$|^\/(fr\/)?(account|contracts)(\/|$)/;

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const publicPath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  const darkTop = DARK_TOP.test(publicPath);

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

  /** over the opening picture: transparent, white lettering */
  const overPicture = darkTop && !scrolled;

  /** [href, label, only on wide screens] — seven links do not fit 1280px */
  const links: Array<[string, string, boolean?]> = [
    [localePath(locale, "/villa"), t.nav.villa],
    [localePath(locale, "/tour"), t.nav.tour],
    [localePath(locale, "/gallery"), t.nav.gallery],
    [localePath(locale, "/rates"), t.nav.rates],
    [localePath(locale, "/pointe-milou"), t.nav.pointeMilou, true],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/contact"), t.nav.contact],
  ];
  /** the mobile menu: everything the tab bar doesn't carry */
  const secondary: Array<[string, string]> = [
    [localePath(locale, "/pointe-milou"), t.nav.pointeMilou],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/map"), t.nav.map],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/why-book-direct"), t.footer.whyDirect],
    [localePath(locale, "/faq"), "FAQ"],
    [localePath(locale, "/contact"), t.nav.contact],
  ];

  // Language switch keeps the current page. Static pages are prerendered
  // under the internal `/en/…` path, so both prefixes must go — otherwise the
  // HTML crawlers read carries `/en/villa` and `/fr/en/villa` links.
  const pathNoLocale = pathname.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";
  const frHref = pathNoLocale === "/" ? "/fr" : `/fr${pathNoLocale}`;
  const isCurrent = (href: string) => publicPath === href || (href !== "/" && publicPath.startsWith(href + "/"));

  const ink = overPicture ? "text-white" : "text-ink";
  const soft = overPicture ? "text-white/75 hover:text-white" : "text-ink/65 hover:text-ink";

  return (
    <>
      {/* ── Desktop / large screens ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 hidden transition-[background-color,box-shadow,backdrop-filter] duration-500 xl:block ${
          overPicture
            ? "bg-gradient-to-b from-black/35 to-transparent"
            : "bg-paper/85 shadow-[0_1px_0_rgba(16,24,32,0.08)] backdrop-blur-xl backdrop-saturate-150"
        }`}
      >
        <div className="ov-shell flex h-[4.5rem] items-center justify-between gap-8">
          <Link
            href={localePath(locale, "/")}
            className="group flex shrink-0 items-baseline gap-3 leading-none"
            aria-label="Villa ONLY VIEW — home"
          >
            <span className={`font-display text-[1.45rem] tracking-[0.26em] transition group-hover:text-gold ${ink}`}>
              ONLY&nbsp;VIEW
            </span>
            <span className={`ov-label !text-[0.6rem] ${overPicture ? "text-white/60" : "text-ink/45"}`}>
              St&nbsp;Barth
            </span>
          </Link>

          <nav className="flex items-center gap-6 2xl:gap-8" aria-label="Main">
            {links.map(([href, label, wide]) => {
              const current = isCurrent(href.replace(/^\/en(?=\/|$)/, "") || "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`relative py-2 text-[0.84rem] transition ${current ? ink : soft} ${wide ? "hidden 2xl:block" : ""}`}
                >
                  {label}
                  {current && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-gold" aria-hidden />}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-5">
            <div className="ov-label flex items-center gap-1.5">
              <Link href={pathNoLocale} className={locale === "en" ? "text-gold" : soft} hrefLang="en">
                EN
              </Link>
              <span className={overPicture ? "text-white/30" : "text-ink/25"}>/</span>
              <Link href={frHref} className={locale === "fr" ? "text-gold" : soft} hrefLang="fr">
                FR
              </Link>
            </div>
            <Link href={localePath(locale, "/account")} className={`text-[0.84rem] transition ${soft}`}>
              {t.nav.account}
            </Link>
            <Link href={localePath(locale, "/booking")} className="ov-btn ov-btn-gold !min-h-[2.6rem] !px-5">
              {t.nav.booking}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile: floating glass bar (the tab bar carries navigation) ──
          Like an iOS 26 navigation bar it collapses to the leading edge as the
          page scrolls: the wordmark capsule shrinks to its content on the left
          and the menu sits in its own glass button on the right. */}
      {/* Safari 26 ignores theme-color and tints the status bar from an opaque,
          full-width fixed element (≥6px) at the top edge, else from the body's
          background, which showed as a white strip above the hero. The
          home-screen app draws under its status bar instead, so the band is
          hidden there (.browser-only). */}
      <div aria-hidden className="browser-only pointer-events-none fixed inset-x-0 top-0 z-50 h-1.5 bg-night xl:hidden" />
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
              className="block overflow-hidden whitespace-nowrap font-mono text-[0.5rem] uppercase tracking-[0.3em] text-gold"
              style={{
                maxHeight: scrolled ? 0 : "0.9rem",
                opacity: scrolled ? 0 : 1,
                marginTop: scrolled ? 0 : "0.2rem",
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
              <path d="M4 9h16M4 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile menu: an editorial sheet on warm paper ── */}
      <div className={`fixed inset-0 z-[60] xl:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-night/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-x-2 bottom-2 overflow-hidden rounded-[1.75rem] bg-paper text-ink shadow-2xl transition-all duration-400 ${
            open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-modal="true"
          aria-label={t.navShort.more}
        >
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <span className="ov-label text-ink/45">Saint-Barthélemy</span>
            <button
              onClick={() => setOpen(false)}
              className="tap flex h-11 w-11 items-center justify-center rounded-full bg-ink/6 text-ink/70"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="px-5" aria-label="Secondaire">
            {secondary.map(([href, label]) => {
              const current = isCurrent(href.replace(/^\/en(?=\/|$)/, "") || "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`tap ov-rule flex items-center justify-between border-b py-3 font-display text-[1.65rem] leading-tight ${
                    current ? "text-gold-dark" : "text-ink"
                  }`}
                >
                  {label}
                  <ArrowUpRight className="h-5 w-5 text-ink/35" strokeWidth={1.25} aria-hidden />
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 px-5">
            <div className="flex items-center gap-1 rounded-full bg-ink/6 p-1 font-mono text-xs uppercase tracking-widest">
              <Link
                href={pathNoLocale}
                className={`rounded-full px-4 py-3 ${locale === "en" ? "bg-ink text-white" : "text-ink/60"}`}
              >
                EN
              </Link>
              <Link
                href={frHref}
                className={`rounded-full px-4 py-3 ${locale === "fr" ? "bg-ink text-white" : "text-ink/60"}`}
              >
                FR
              </Link>
            </div>
            <Link href={localePath(locale, "/account")} className="ov-btn ov-btn-line">
              {t.nav.account}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
