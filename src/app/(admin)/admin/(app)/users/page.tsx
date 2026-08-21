import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UsersBoard } from "@/components/admin/UsersBoard";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") redirect("/admin");
  return <UsersBoard currentUserId={user.id} />;
}
