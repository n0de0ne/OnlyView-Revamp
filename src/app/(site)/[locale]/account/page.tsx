import type { Metadata } from "next";
import Link from "next/link";
import { getDict, isLocale, localePath, tpl, type Locale } from "@/lib/i18n";
import { getGuestClientId } from "@/lib/guest-auth";
import { prisma } from "@/lib/db";
import { formatDateShort, toISODate, todayISO, nightsBetween } from "@/lib/dates";
import { usd } from "@/lib/money";
import { tierFor, nextTier } from "@/lib/loyalty";
import { PageHero } from "@/components/site/PageHero";
import { GuestLoginForm } from "@/components/site/GuestLoginForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return {
    title: t.meta.titleAccount,
    description: t.meta.descAccount,
    robots: { index: false },
  };
}

const STATUS_STYLE: Record<string, string> = {
  option: "bg-st-option/15 text-st-option border-st-option/40",
  confirmed: "bg-st-free/15 text-st-free border-st-free/40",
  pending: "bg-st-pending/15 text-st-pending border-st-pending/40",
  cancelled: "bg-slate-200 text-slate-500 border-slate-300",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);

  const clientId = await getGuestClientId();

  if (!clientId) {
    return (
      <>
        <PageHero eyebrow={t.account.title} title={t.account.loginTitle} />
        <section className="mx-auto max-w-md px-5 py-16 lg:px-8">
          <GuestLoginForm locale={locale} />
        </section>
      </>
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      reservations: {
        where: { status: { not: "blocked" } },
        orderBy: { startDate: "desc" },
        include: {
          contracts: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      loyalty: {
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: 12 },
        },
      },
    },
  });

  if (!client) {
    return (
      <>
        <PageHero eyebrow={t.account.title} title={t.account.loginTitle} />
        <section className="mx-auto max-w-md px-5 py-16 lg:px-8">
          <GuestLoginForm locale={locale} />
        </section>
      </>
    );
  }

  const today = todayISO();
  const upcoming = client.reservations.filter((r) => toISODate(r.endDate) >= today);
  const past = client.reservations.filter((r) => toISODate(r.endDate) < today);
  const points = client.loyalty?.points ?? 0;
  const lifetime = client.loyalty?.lifetimePoints ?? 0;
  const tier = tierFor(lifetime);
  const next = nextTier(lifetime);

  const ReservationCard = ({
    r,
  }: {
    r: (typeof client.reservations)[number];
  }) => {
    const contract = r.contracts[0];
    return (
      <div className="border border-ink/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-xl">
            {formatDateShort(r.startDate, locale)} → {formatDateShort(r.endDate, locale)}
          </div>
          <span
            className={`border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest ${STATUS_STYLE[r.status] ?? STATUS_STYLE.pending}`}
          >
            {t.account.statuses[r.status] ?? r.status}
          </span>
        </div>
        <div className="mt-2 text-sm text-ink/60">
          {nightsBetween(toISODate(r.startDate), toISODate(r.endDate))} {t.account.nightsShort} ·{" "}
          {r.bedrooms} {t.common.bedrooms} · {r.guests} {t.common.guestsWord}
        </div>

        <div className="mt-5 grid gap-4 border-t border-ink/8 pt-5 sm:grid-cols-2">
          <div>
            <div className="eyebrow !text-[0.6rem]">{t.account.paymentTitle}</div>
            <div className="mt-2 text-sm">
              <div className="font-semibold">{usd(r.priceTTC)}</div>
              <div className="mt-1 text-xs text-ink/60">
                {r.balanceReceived
                  ? `✓ ${t.account.balanceReceived}`
                  : r.depositReceived
                    ? `✓ ${t.account.depositReceived} (${usd(r.depositAmount)})`
                    : `· ${t.account.awaitingDeposit} (${usd(r.depositAmount)})`}
              </div>
            </div>
          </div>
          <div>
            <div className="eyebrow !text-[0.6rem]">{t.account.contractTitle}</div>
            <div className="mt-2 text-sm">
              {contract ? (
                contract.status === "signed" ? (
                  <div>
                    <span className="text-st-free">✓ {t.account.contractSigned}</span>
                    <a
                      href={`/api/contracts/pdf/${contract.token}`}
                      className="ml-3 text-xs text-gold underline"
                    >
                      {t.account.downloadPdf}
                    </a>
                  </div>
                ) : (
                  <Link
                    href={localePath(locale, `/contracts/sign/${contract.token}`)}
                    className="text-gold underline"
                  >
                    → {t.account.contractSign}
                  </Link>
                )
              ) : (
                <span className="text-ink/40">—</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHero
        eyebrow={t.account.title}
        title={`${t.account.welcome}, ${client.firstname}`}
      />
      <section className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            <div>
              <h2 className="section-title mb-6 !text-2xl">{t.account.upcoming}</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink/50">{t.account.noStays}</p>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((r) => (
                    <ReservationCard key={r.id} r={r} />
                  ))}
                </div>
              )}
            </div>
            {past.length > 0 && (
              <div>
                <h2 className="section-title mb-6 !text-2xl">{t.account.past}</h2>
                <div className="space-y-4 opacity-80">
                  {past.map((r) => (
                    <ReservationCard key={r.id} r={r} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Loyalty sidebar */}
          <aside className="space-y-6">
            <div className="border border-gold/40 bg-night p-7 text-white">
              <h2 className="eyebrow mb-5">{t.account.loyaltyTitle}</h2>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display text-5xl text-gold">{points}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-white/60">
                    {t.account.pointsBalance}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl capitalize">
                    {t.account.tiers[tier]}
                  </div>
                  <div className="text-[0.6rem] uppercase tracking-widest text-white/50">
                    {t.account.tier}
                  </div>
                </div>
              </div>
              {next && (
                <div className="mt-5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full bg-gold"
                      style={{
                        width: `${Math.min(100, Math.round((lifetime / (lifetime + next.missing)) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    {tpl(t.account.nextTier, {
                      points: next.missing,
                      tier: t.account.tiers[next.tier],
                    })}
                  </p>
                </div>
              )}
              <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/60">
                {t.account.pointsHow}
              </p>
            </div>

            {(client.loyalty?.transactions.length ?? 0) > 0 && (
              <div className="border border-ink/10 bg-white p-6">
                <h3 className="eyebrow mb-4">{t.account.historyTitle}</h3>
                <ul className="divide-y divide-ink/8 text-sm">
                  {client.loyalty!.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-ink/80">{tx.reason ?? tx.kind}</div>
                        <div className="text-[0.65rem] text-ink/40">
                          {formatDateShort(tx.createdAt, locale)}
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${tx.points >= 0 ? "text-st-free" : "text-st-confirmed"}`}
                      >
                        {tx.points >= 0 ? "+" : ""}
                        {tx.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border border-ink/10 bg-white p-6 text-sm">
              <h3 className="eyebrow mb-4">{t.account.profileTitle}</h3>
              <p className="font-semibold">
                {client.firstname} {client.lastname}
              </p>
              <p className="text-ink/60">{client.email}</p>
              {client.phone && <p className="text-ink/60">{client.phone}</p>}
              <form action={`/api/account/logout?locale=${locale}`} method="POST" className="mt-5">
                <button className="btn-outline !px-4 !py-2 text-xs">{t.account.logout}</button>
              </form>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
