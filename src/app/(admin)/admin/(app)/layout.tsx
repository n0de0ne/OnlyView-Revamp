import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/ui";
import { isLoyaltyEnabled } from "@/lib/features";

export default async function AdminAppLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal?: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  const loyalty = await isLoyaltyEnabled();

  return (
    <ToastProvider>
      <AdminShell user={user} features={{ loyalty }}>
        {children}
      </AdminShell>
      {/* Intercepted routes (reservation editor…) render here, over the page
          the user came from, so the list/calendar keeps its scroll and filters. */}
      {modal}
    </ToastProvider>
  );
}
