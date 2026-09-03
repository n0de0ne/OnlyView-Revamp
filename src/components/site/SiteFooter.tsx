import Link from "next/link";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const year = new Date().getFullYear();

  const explore: Array<[string, string]> = [
    [localePath(locale, "/villa"), t.nav.villa],
    [localePath(locale, "/tour"), t.nav.tour],
    [localePath(locale, "/gallery"), t.nav.gallery],
    [localePath(locale, "/rates"), t.nav.rates],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/map"), t.nav.map],
  ];
  const practical: Array<[string, string]> = [
    [localePath(locale, "/booking"), t.nav.booking],
    [localePath(locale, "/why-book-direct"), t.footer.whyDirect],
    [localePath(locale, "/location"), t.nav.villa + " — " + t.location.title],
    [localePath(locale, "/faq"), "FAQ"],
    [localePath(locale, "/contact"), t.nav.contact],
    [localePath(locale, "/account"), t.footer.guestPortal],
  ];

  return (
    <footer className="bg-night text-white/70">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="font-display text-2xl tracking-[0.32em] text-white">
              ONLY&nbsp;VIEW
            </div>
            <div className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.42em] text-gold">
              Saint-Barthélemy
            </div>
            <p className="mt-5 max-w-xs font-display text-lg italic text-white/60">
              “{t.footer.tagline}”
            </p>
            <p className="mt-6 text-sm leading-relaxed">
              Villa ONLY VIEW · Pointe Milou
              <br />
              97133 Saint-Barthélemy, French West Indies
            </p>
            <span className="mt-5 inline-block border border-gold/50 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-gold">
              {t.footer.directBadge}
            </span>
          </div>

          <nav aria-label={t.footer.explore}>
            <h3 className="eyebrow mb-5">{t.footer.explore}</h3>
            <ul className="space-y-2.5 text-sm">
              {explore.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.practical}>
            <h3 className="eyebrow mb-5">{t.footer.practical}</h3>
            <ul className="space-y-2.5 text-sm">
              {practical.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-7 text-xs text-white/40 md:flex-row md:items-center">
          <p>
            © {year} Villa ONLY VIEW. {t.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href={localePath(locale, "/legal")} className="inline-block py-3 hover:text-gold">
              {t.footer.legal}
            </Link>
            <Link href={localePath(locale, "/privacy")} className="inline-block py-3 hover:text-gold">
              {t.footer.privacy}
            </Link>
            <Link href="/admin" className="inline-block py-3 hover:text-gold">
              {t.footer.admin}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
