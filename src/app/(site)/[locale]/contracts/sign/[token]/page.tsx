import type { Metadata } from "next";
import { getDict, isLocale, tpl, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { formatDate, formatDateShort } from "@/lib/dates";
import { SignaturePad } from "@/components/site/SignaturePad";
import { PageHero } from "@/components/site/PageHero";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return { title: t.contract.title, robots: { index: false } };
}

export default async function SignContractPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: raw, token } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const t = getDict(locale);

  const contract = await prisma.contract.findUnique({
    where: { token },
    include: { reservation: true },
  });

  if (!contract || contract.status === "void") {
    return (
      <>
        <PageHero title={t.contract.title} />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="text-ink/60">{t.contract.notFound}</p>
        </section>
      </>
    );
  }

  const expired =
    contract.status !== "signed" &&
    contract.expiresAt != null &&
    contract.expiresAt < new Date();

  // Track views (best effort)
  if (contract.status === "pending" && !expired) {
    prisma.contract
      .update({
        where: { id: contract.id },
        data: {
          viewCount: { increment: 1 },
          firstViewedAt: contract.firstViewedAt ?? new Date(),
          lastViewedAt: new Date(),
        },
      })
      .catch(() => {});
  }

  const r = contract.reservation;

  return (
    <>
      <PageHero
        eyebrow="Villa ONLY VIEW"
        title={t.contract.title}
        intro={`${t.contract.forStay}: ${formatDateShort(r.startDate, locale)} → ${formatDateShort(r.endDate, locale)} · ${contract.clientName}`}
      />
      <section className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        {contract.status === "signed" ? (
          <div className="mb-8 border border-st-free/40 bg-st-free/10 p-6">
            <h2 className="font-display text-2xl text-st-free">✓ {t.contract.signedTitle}</h2>
            <p className="mt-2 text-sm text-ink/70">
              {tpl(t.contract.alreadySigned, {
                date: formatDate(contract.signedAt ?? new Date(), locale),
              })}
            </p>
            <a
              href={`/api/contracts/pdf/${contract.token}`}
              className="btn-gold mt-5 !px-5 !py-2.5"
            >
              {t.account.downloadPdf}
            </a>
          </div>
        ) : expired ? (
          <div className="mb-8 border border-st-option/50 bg-st-option/10 p-6 text-sm text-st-option">
            {t.contract.expired}
          </div>
        ) : (
          <p className="mb-8 text-ink/70">{t.contract.reviewText}</p>
        )}

        {/* Contract body */}
        <div
          className="contract-body border border-ink/10 bg-white p-8 leading-relaxed [&_h1]:font-display [&_h3]:mt-6 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_table]:my-4 md:p-12"
          dangerouslySetInnerHTML={{ __html: contract.bodyHtml }}
        />

        {contract.status === "pending" && !expired && (
          <div className="mt-8">
            <SignaturePad
              token={contract.token}
              locale={locale}
              expectedName={contract.clientName}
            />
          </div>
        )}

        <div className="mt-6 text-center">
          <a
            href={`/api/contracts/pdf/${contract.token}`}
            className="text-sm text-gold underline"
          >
            {t.account.downloadPdf}
          </a>
        </div>
      </section>
    </>
  );
}
