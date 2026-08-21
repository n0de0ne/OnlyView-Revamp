import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FinanceBoard } from "@/components/admin/FinanceBoard";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/admin");
  return <FinanceBoard />;
}
