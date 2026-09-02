import { ClientsCrm } from "@/components/admin/ClientsCrm";
import { isLoyaltyEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  return <ClientsCrm loyaltyEnabled={await isLoyaltyEnabled()} />;
}
