import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { guestEditableReservation } from "@/lib/guest-stay";
import { toISODate } from "@/lib/dates";
import { detectPlatform, prefilledBookingUrl } from "@/lib/booking-platforms";
import { PageHero } from "@/components/site/PageHero";
import { ZenchefBooking } from "@/components/site/ZenchefBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false } };

/** Book a Zenchef restaurant without leaving the portal: ?r=<stay>&p=<place>&date=&guests= */
export default async function BookTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);
  const q = await searchParams;
  const back = localePath(locale, "/account");

  const r = await guestEditableReservation(parseInt(q.r ?? "", 10));
  const place = q.p ? await prisma.mapPlace.findUnique({ where: { id: parseInt(q.p, 10) } }) : null;
  const ref = detectPlatform(place?.bookingUrl);
  const date = q.date ?? "";
  const guests = Math.min(30, Math.max(1, parseInt(q.guests ?? "", 10) || 2));
  if (
    !r ||
    !place ||
    !place.isActive ||
    ref?.platform !== "zenchef" ||
    !ref.id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < toISODate(r.startDate) ||
    date > toISODate(r.endDate)
  ) {
    redirect(back);
  }

  return (
    <>
      <PageHero eyebrow={t.account.title} title={t.account.concierge.title} />
      <section className="mx-auto max-w-xl px-5 py-14 lg:px-8">
        <ZenchefBooking
          reservationId={r.id}
          placeId={place.id}
          name={place.name}
          rid={ref.id}
          date={date}
          guests={guests}
          locale={locale}
          fallbackUrl={prefilledBookingUrl(place.bookingUrl!, ref, { date, guests })}
          backHref={back}
          t={t.account.concierge}
        />
      </section>
    </>
  );
}
