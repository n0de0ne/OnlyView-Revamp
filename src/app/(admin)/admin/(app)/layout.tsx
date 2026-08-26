import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/ui";

export default async function AdminAppLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal?: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <ToastProvider>
      <AdminShell user={user}>{children}</AdminShell>
      {/* Intercepted routes (reservation editor…) render here, over the page
          the user came from, so the list/calendar keeps its scroll and filters. */}
      {modal}
    </ToastProvider>
  );
}
