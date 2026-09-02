"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      className="h-[22px] w-[22px]"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

/**
 * iOS-style floating tab bar: the primary destinations plus an unmissable
 * booking action, on a liquid-glass capsule that lets the page show through.
 * Mobile/tablet only — the desktop header keeps the full navigation.
 */
export function MobileTabBar({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname();

  const tabs: Array<{ href: string; label: string; icon: keyof typeof icons }> = [
    { href: localePath(locale, "/villa"), label: t.navShort.villa, icon: "villa" },
    { href: localePath(locale, "/tour"), label: t.navShort.tour, icon: "tour" },
    { href: localePath(locale, "/gallery"), label: t.navShort.gallery, icon: "gallery" },
    { href: localePath(locale, "/rates"), label: t.navShort.rates, icon: "rates" },
  ];
  const bookHref = localePath(locale, "/booking");
  const onBooking = pathname === bookHref;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 xl:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Principal"
    >
      <div className="mx-3 flex items-center gap-2">
        <div className="glass-bar flex min-w-0 flex-1 items-center rounded-[1.65rem] p-1.5">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`tap relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.3rem] px-0.5 py-2 ${
                  active ? "text-navy" : "text-ink/55"
                }`}
              >
                {active && (
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
                  className={`relative max-w-full truncate text-[0.58rem] font-semibold uppercase tracking-[0.06em] ${
                    active ? "text-navy" : "text-ink/65"
                  }`}
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
          className="tap flex h-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[1.65rem] px-4 text-white"
          style={{
            background:
              "linear-gradient(160deg, var(--color-gold-light), var(--color-gold) 55%, var(--color-gold-dark))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.55), 0 10px 26px -8px rgba(201,169,98,.75), 0 2px 10px -4px rgba(12,20,27,.35)",
          }}
        >
          <Icon name="book" active />
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em]">
            {t.navShort.booking}
          </span>
        </Link>
      </div>
    </nav>
  );
}
