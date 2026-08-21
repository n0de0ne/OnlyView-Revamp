import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SettingsBoard } from "@/components/admin/SettingsBoard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/admin");
  return <SettingsBoard />;
}
