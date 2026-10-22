import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RatePeriodsBoard } from "@/components/admin/RatePeriodsBoard";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/admin");
  return <RatePeriodsBoard />;
}
