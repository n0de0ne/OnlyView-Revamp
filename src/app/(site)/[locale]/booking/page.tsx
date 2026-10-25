import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n";
import { getContent } from "@/lib/site-content";
import { breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getBookedRanges } from "@/lib/availability";
import { todayISO, addDays } from "@/lib/dates";
import { BookingWidget } from "@/components/site/BookingWidget";
import { PageHero } from "@/components/site/PageHero";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);
  return pageMetadata({
    locale,
    path: "/booking",
    title: t.meta.titleBooking,
    description: t.meta.descBooking,
  });
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = await getContent(locale);

  let bookings: Array<{ start: string; end: string; status: "confirmed" | "option" }> = [];
  try {
    const ranges = await getBookedRanges({
      from: todayISO(),
      to: addDays(todayISO(), 730),
    });
    bookings = ranges.map((r) => ({
      start: r.start,
      end: r.end,
      status: r.status === "confirmed" ? "confirmed" : "option",
    }));
  } catch {
    // empty calendar fallback
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: t.nav.home, url: locale === "fr" ? "/fr" : "/" },
              { name: t.nav.booking, url: locale === "fr" ? "/fr/booking" : "/booking" },
            ])
          ),
        }}
      />
      <PageHero eyebrow={t.nav.booking} title={t.booking.title} intro={t.booking.intro} compact />
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-5 md:py-14 lg:px-8">
        <BookingWidget locale={locale} initialBookings={bookings} />
      </section>
    </>
  );
}
