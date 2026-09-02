"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDict, localePath, type Locale } from "@/lib/i18n";

/* Line icons (1.6 stroke) — no icon dependency, crisp at 22px */
const icons = {
  villa: (
    <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.75 20v-5.25h4.5V20" />
  ),
  tour: (
    <>
      <path d="M12 21c4.97 0 9-1.79 9-4s-4.03-4-9-4-9 1.79-9 4 4.03 4 9 4Z" />
      <path d="M12 13V8.5" />
      <circle cx="12" cy="6" r="2.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 17" />
    </>
  ),
  rates: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2a3 3 0 0 0-2.5-1.2c-1.5 0-2.5.8-2.5 2s1 1.8 2.5 2 2.5.6 2.5 2-1 2-2.5 2a3 3 0 0 1-2.5-1.2M12 6.2v1.6M12 16.2v1.6" />
    </>
  ),
  book: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 14v4M10 16h4" />
    </>
  ),
};

function Icon({ name, active }: { name: keyof typeof icons; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px] shrink-0"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

/** Apple's standard interruptible-spring curve. */
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * iOS-style floating tab bar on liquid glass.
 *
 * Like iOS 26's `tabBarMinimizeBehavior(.onScrollDown)`, it minimises while
 * the page scrolls down — the inactive tabs and the labels collapse away,
 * leaving a compact pill with the current section and the booking action —
 * and springs back open on scroll up, at the top of the page, or on a tap.
 */
export function MobileTabBar({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  // the prerender pathname is /en/x — compare on the public path
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "") || "/";
  const [collapsed, setCollapsed] = useState(false);

  const tabs: Array<{ href: string; label: string; icon: keyof typeof icons }> = [
    { href: localePath(locale, "/villa"), label: t.navShort.villa, icon: "villa" },
    { href: localePath(locale, "/tour"), label: t.navShort.tour, icon: "tour" },
    { href: localePath(locale, "/gallery"), label: t.navShort.gallery, icon: "gallery" },
    { href: localePath(locale, "/rates"), label: t.navShort.rates, icon: "rates" },
  ];
  const bookHref = localePath(locale, "/booking");
  const onBooking = pathname === bookHref;
  const activeIndex = tabs.findIndex((tab) => tab.href === pathname);
  /** the tab kept visible while minimised (the current one, else the first) */
  const keptIndex = activeIndex >= 0 ? activeIndex : 0;

  /* ── minimise on scroll down, restore on scroll up / at the top ── */
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const settle = () => {
      const y = window.scrollY;
      const dy = y - last;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (y < 90 || y > max - 90) setCollapsed(false); // top and bottom edges
      else if (dy > 8) setCollapsed(true);
      else if (dy < -8) setCollapsed(false);
      last = y;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(settle);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // a new page always starts open
  useEffect(() => setCollapsed(false), [pathname]);

  /** first tap on a minimised bar expands it instead of navigating */
  const interceptWhenCollapsed = useCallback(
    (e: React.MouseEvent) => {
      if (!collapsed) return;
      e.preventDefault();
      setCollapsed(false);
    },
    [collapsed]
  );

  const barRef = useRef<HTMLDivElement>(null);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 xl:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Principal"
    >
      {/* justify-between so the pill collapses onto the leading edge and the
          booking capsule keeps the trailing one, like the header above */}
      <div
        className="mx-3 flex items-center justify-between gap-2"
        style={{
          transition: `transform 520ms ${SPRING}`,
          transform: collapsed ? "translateY(2px)" : "none",
        }}
      >
        <div
          ref={barRef}
          onClick={interceptWhenCollapsed}
          className={`glass-bar flex min-w-0 items-center rounded-[1.65rem] ${
            collapsed ? "flex-none p-1" : "flex-1 p-1.5"
          }`}
          style={{ transition: `padding 520ms ${SPRING}, flex-grow 520ms ${SPRING}` }}
        >
          {tabs.map((tab, i) => {
            const active = i === activeIndex;
            const kept = i === keptIndex;
            const hidden = collapsed && !kept;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-hidden={hidden || undefined}
                tabIndex={hidden ? -1 : undefined}
                onClick={interceptWhenCollapsed}
                className={`tap relative flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.3rem] ${
                  active ? "text-navy" : "text-ink/55"
                }`}
                style={{
                  flex: hidden ? "0 0 0px" : "1 1 0px",
                  maxWidth: hidden ? 0 : "8rem",
                  opacity: hidden ? 0 : 1,
                  paddingBlock: collapsed ? "0.4rem" : "0.5rem",
                  paddingInline: hidden ? 0 : collapsed ? "0.7rem" : "0.125rem",
                  transition: `flex 520ms ${SPRING}, max-width 520ms ${SPRING}, opacity 320ms ease, padding 520ms ${SPRING}`,
                }}
              >
                {active && !collapsed && (
                  <span
                    className="absolute inset-0 rounded-[1.3rem] bg-white/70"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)" }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <Icon name={tab.icon} active={active} />
                </span>
                <span
                  className={`relative block max-w-full truncate text-[0.58rem] font-semibold uppercase tracking-[0.06em] ${
                    active ? "text-navy" : "text-ink/65"
                  }`}
                  style={{
                    maxHeight: collapsed ? 0 : "1rem",
                    opacity: collapsed ? 0 : 1,
                    transition: `max-height 520ms ${SPRING}, opacity 260ms ease`,
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href={bookHref}
          aria-current={onBooking ? "page" : undefined}
          className="tap flex shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.65rem] text-white"
          style={{
            height: collapsed ? "3.1rem" : "4.25rem",
            paddingInline: collapsed ? "0.95rem" : "1rem",
            background:
              "linear-gradient(160deg, var(--color-gold-light), var(--color-gold) 55%, var(--color-gold-dark))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.55), 0 10px 26px -8px rgba(201,169,98,.75), 0 2px 10px -4px rgba(12,20,27,.35)",
            transition: `height 520ms ${SPRING}, padding 520ms ${SPRING}`,
          }}
        >
          <Icon name="book" active />
          <span
            className="block overflow-hidden text-[0.6rem] font-bold uppercase tracking-[0.08em]"
            style={{
              maxHeight: collapsed ? 0 : "1rem",
              opacity: collapsed ? 0 : 1,
              transition: `max-height 520ms ${SPRING}, opacity 260ms ease`,
            }}
          >
            {t.navShort.booking}
          </span>
        </Link>
      </div>
    </nav>
  );
}
