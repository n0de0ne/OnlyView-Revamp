import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SettingsBoard } from "@/components/admin/SettingsBoard";
import { OwnerSignatureCard } from "@/components/admin/OwnerSignatureCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/admin");
  return (
    <div className="space-y-5">
      <SettingsBoard />
      <OwnerSignatureCard />
    </div>
  );
}
