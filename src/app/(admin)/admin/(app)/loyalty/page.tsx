import { notFound } from "next/navigation";
import { LoyaltyBoard } from "@/components/admin/LoyaltyBoard";
import { isLoyaltyEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  // the programme is switched off in Réglages — the board stays in the code
  if (!(await isLoyaltyEnabled())) notFound();
  return <LoyaltyBoard />;
}
