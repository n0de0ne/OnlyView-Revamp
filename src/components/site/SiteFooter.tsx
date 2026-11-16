import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { getContact } from "@/lib/contact";

/**
 * The ending: navigation weighted to the right, the practical details low,
 * and the villa's name as a monumental wordmark across the foot — an
 * identity, not another sales line.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const [t, contact] = await Promise.all([getContent(locale), getContact()]);
  const year = new Date().getFullYear();

  const explore: Array<[string, string]> = [
    [localePath(locale, "/villa"), t.nav.villa],
    [localePath(locale, "/tour"), t.nav.tour],
    [localePath(locale, "/gallery"), t.nav.gallery],
    [localePath(locale, "/reviews"), t.nav.reviews],
    [localePath(locale, "/pointe-milou"), t.nav.pointeMilou],
    [localePath(locale, "/guide"), t.nav.guide],
    [localePath(locale, "/map"), t.nav.map],
  ];
  const practical: Array<[string, string]> = [
    [localePath(locale, "/rates"), t.nav.rates],
    [localePath(locale, "/booking"), t.nav.booking],
    [localePath(locale, "/why-book-direct"), t.footer.whyDirect],
    [localePath(locale, "/faq"), "FAQ"],
    [localePath(locale, "/contact"), t.nav.contact],
    [localePath(locale, "/account"), t.footer.guestPortal],
  ];

  return (
    <footer className="overflow-hidden bg-night text-white/70">
      <div className="ov-shell pt-20 md:pt-28">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="max-w-sm font-display text-3xl italic leading-tight text-white/90">“{t.footer.tagline}”</p>
            <p className="ov-label mt-8 leading-relaxed text-white/50">
              Villa ONLY VIEW · Pointe Milou
              <br />
              97133 Saint-Barthélemy · French West Indies
            </p>
            <span className="ov-label mt-6 inline-flex items-center gap-2 rounded-full border border-gold/40 px-3.5 py-2 text-gold">
              {t.footer.directBadge}
            </span>
          </div>

          <nav aria-label={t.footer.explore} className="lg:col-span-2 lg:col-start-6">
            <h3 className="ov-label mb-5 text-white/40">{t.footer.explore}</h3>
            <ul className="space-y-2">
              {explore.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-block py-1 text-[0.95rem] text-white/80 transition hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.practical} className="lg:col-span-2">
            <h3 className="ov-label mb-5 text-white/40">{t.footer.practical}</h3>
            <ul className="space-y-2">
              {practical.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-block py-1 text-[0.95rem] text-white/80 transition hover:text-gold">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h3 className="ov-label mb-5 text-white/40">{t.nav.contact}</h3>
            <ul className="space-y-2 text-[0.95rem]">
              {contact.whatsappUrl && (
                <li>
                  <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-block py-1 text-white/80 transition hover:text-gold">
                    WhatsApp
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="inline-block py-1 [overflow-wrap:anywhere] text-white/80 transition hover:text-gold">
                    {contact.email}
                  </a>
                </li>
              )}
              {/* the villa's own social profiles — never the agencies' listings */}
              {contact.sameAs
                .filter((url) => /instagram\.com|facebook\.com|tripadvisor\.|youtube\.com/.test(url))
                .slice(0, 3)
                .map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block py-1 capitalize text-white/80 transition hover:text-gold">
                    {new URL(url).hostname.replace(/^www\./, "").split(".")[0]}
                  </a>
                </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      {/* the wordmark, as wide as the page */}
      <div className="ov-shell mt-20 md:mt-28" aria-hidden>
        <div className="select-none whitespace-nowrap text-center font-display text-[15.8vw] md:text-[17.5vw] leading-[0.8] tracking-[-0.03em] text-white/[0.92] min-[1440px]:text-[15.5rem]">
          ONLY VIEW
        </div>
      </div>

      <div className="ov-shell">
        <div className="ov-rule-light flex flex-col items-start justify-between gap-2 border-t py-5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/40 md:flex-row md:items-center">
          <p>
            © {year} Villa ONLY VIEW. {t.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-6">
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
