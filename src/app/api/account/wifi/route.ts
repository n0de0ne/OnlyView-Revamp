import { getGuestClientId } from "@/lib/guest-auth";
import { getWifi, hasStayInfoAccess, wifiMobileconfig } from "@/lib/stay-info";

export const dynamic = "force-dynamic";

/**
 * The villa's Wi-Fi as an Apple configuration profile (iPhone, iPad, Mac):
 * for a signed-in guest whose confirmed stay is near or under way.
 */
export async function GET() {
  const clientId = await getGuestClientId();
  if (!clientId || !(await hasStayInfoAccess(clientId))) return new Response("Not found", { status: 404 });
  const wifi = await getWifi();
  if (!wifi) return new Response("Not found", { status: 404 });
  return new Response(wifiMobileconfig(wifi, `Wi-Fi Villa ONLY VIEW`), {
    headers: {
      "Content-Type": "application/x-apple-aspen-config",
      "Content-Disposition": 'attachment; filename="OnlyView-WiFi.mobileconfig"',
      "Cache-Control": "private, no-store",
    },
  });
}
