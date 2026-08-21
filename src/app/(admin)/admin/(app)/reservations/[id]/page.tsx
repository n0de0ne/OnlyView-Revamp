import { notFound } from "next/navigation";
import { getRateConfig, getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { ReservationEditor } from "@/components/admin/ReservationEditor";

export const dynamic = "force-dynamic";

export default async function ReservationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const numId = isNew ? null : parseInt(id, 10);
  if (!isNew && (numId == null || Number.isNaN(numId))) notFound();

  const [rates, settings, agencies] = await Promise.all([
    getRateConfig(),
    getSettings(),
    prisma.agency.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, commissionPercent: true },
    }),
  ]);

  return (
    <ReservationEditor
      reservationId={numId}
      rates={rates}
      agencies={agencies}
      costs={{
        cleaningPerDayEUR: parseFloat(settings.cost_cleaning_per_day_eur ?? "66"),
        fixedMonthlyEUR: parseFloat(settings.cost_fixed_monthly_eur ?? "1501.90"),
        eurUsdRate: parseFloat(settings.eur_usd_rate ?? "1.08"),
      }}
      prefill={{ start: sp.start ?? null, end: sp.end ?? null }}
    />
  );
}
