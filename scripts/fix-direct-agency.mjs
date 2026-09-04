/**
 * Repair: direct bookings attached to a "Direct" agency.
 *
 * The legacy PHP site had no "no agency" state — a direct booking carried the
 * agency named "Direct" (flagged is_direct in its agencies table). Here direct
 * means no agency at all: `directShare` counts reservations whose agencyId is
 * null. A database migrated before scripts/migrate-legacy.mjs learned to skip
 * that row therefore reports a 0% direct share, and any commission percentage
 * on that agency is charged against direct bookings in the P&L.
 *
 * This detaches those reservations, zeroes the commission the fake agency
 * carried, and removes the row.
 *
 *   node scripts/fix-direct-agency.mjs           # report only
 *   node scripts/fix-direct-agency.mjs --apply   # write the changes
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const agencies = await prisma.agency.findMany({
  where: { name: { equals: "direct", mode: "insensitive" } },
  include: { _count: { select: { reservations: true } } },
});

if (agencies.length === 0) {
  console.log("Nothing to do: no agency named “Direct”.");
  await prisma.$disconnect();
  process.exit(0);
}

for (const agency of agencies) {
  console.log(
    `Agency #${agency.id} “${agency.name}” — ${agency.commissionPercent}% commission, ${agency._count.reservations} reservation(s) attached`
  );
}

const ids = agencies.map((a) => a.id);
const attached = await prisma.reservation.findMany({
  where: { agencyId: { in: ids } },
  select: { id: true, clientName: true, startDate: true, agencyFeePercent: true },
  orderBy: { startDate: "asc" },
});
for (const r of attached) {
  const date = r.startDate.toISOString().slice(0, 10);
  console.log(`  reservation #${r.id} ${date} ${r.clientName ?? ""} (fee ${r.agencyFeePercent}%) → direct`);
}

if (!apply) {
  console.log(`\nReport only. Re-run with --apply to detach ${attached.length} reservation(s) and delete the row(s).`);
  await prisma.$disconnect();
  process.exit(0);
}

const [detached] = await prisma.$transaction([
  prisma.reservation.updateMany({
    where: { agencyId: { in: ids } },
    data: { agencyId: null, agencyFeePercent: 0 },
  }),
  prisma.agency.deleteMany({ where: { id: { in: ids } } }),
]);
console.log(`\nDetached ${detached.count} reservation(s); removed ${ids.length} “Direct” agency row(s).`);
console.log("The direct share and the commission totals are correct from now on.");
await prisma.$disconnect();
