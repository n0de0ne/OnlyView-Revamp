"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Transparent over the home hero, solid everywhere else / on scroll
  const isHome = pathname === "/" || pathname === "/fr";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const solid = scrolled || !isHome || open;

  const links: Array<[string, string]> = [
    [localePath(locale, "/villa"), t.nav.villa],
    [localePath(locale, "/tour"), t.nav.tour],
    [localePath(locale, "/gallery"), t.nav.gallery],
    [localePath(locale, "/rates"), t.nav.rates],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/contact"), t.nav.contact],
  ];

  // Language switch keeps the current page
  const pathNoLocale = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid
          ? "bg-night/95 backdrop-blur-md shadow-lg shadow-black/10"
          : "bg-gradient-to-b from-black/55 to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
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

        <nav className="hidden items-center gap-7 xl:flex" aria-label="Main">
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

        <div className="hidden items-center gap-5 xl:flex">
          <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-widest">
            <Link
              href={pathNoLocale}
              className={locale === "en" ? "text-gold" : "text-white/60 hover:text-white"}
            >
              EN
            </Link>
            <span className="text-white/30">·</span>
            <Link
              href={pathNoLocale === "/" ? "/fr" : `/fr${pathNoLocale}`}
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

        <button
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          <span
            className={`h-px w-6 bg-white transition-all ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
          />
          <span
            className={`h-px w-6 bg-white transition-all ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`xl:hidden overflow-hidden bg-night/98 transition-all duration-400 ${
          open ? "max-h-[560px] border-t border-white/10" : "max-h-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-6 py-5" aria-label="Mobile">
          {[[localePath(locale, "/"), t.nav.home] as [string, string], ...links].map(
            ([href, label]) => (
              <Link
                key={href}
                href={href}
                className="py-2.5 text-sm font-medium uppercase tracking-[0.18em] text-white/85 transition hover:text-gold"
              >
                {label}
              </Link>
            )
          )}
          <Link
            href={localePath(locale, "/account")}
            className="py-2.5 text-sm font-medium uppercase tracking-[0.18em] text-white/85 hover:text-gold"
          >
            {t.nav.account}
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <Link href={localePath(locale, "/booking")} className="btn-gold flex-1">
              {t.nav.booking}
            </Link>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-white/60">
              <Link href={pathNoLocale} className={locale === "en" ? "text-gold" : ""}>
                EN
              </Link>
              <span>·</span>
              <Link
                href={pathNoLocale === "/" ? "/fr" : `/fr${pathNoLocale}`}
                className={locale === "fr" ? "text-gold" : ""}
              >
                FR
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
