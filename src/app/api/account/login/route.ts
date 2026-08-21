import { NextRequest, NextResponse } from "next/server";
import { redeemMagicLink, openGuestSession, resolvePortalToken } from "@/lib/guest-auth";

export const dynamic = "force-dynamic";

/**
 * Two entry paths into the guest portal:
 *  - ?token=…  magic-link (email) — single use
 *  - ?pt=…     reservation portal token (sent by the admin)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const pt = searchParams.get("pt");
  const locale = searchParams.get("locale") === "fr" ? "fr" : "en";
  const accountPath = locale === "fr" ? "/fr/account" : "/account";

  if (token) {
    const clientId = await redeemMagicLink(token);
    if (clientId) {
      return NextResponse.redirect(new URL(accountPath, req.url));
    }
    return NextResponse.redirect(new URL(`${accountPath}?error=link`, req.url));
  }

  if (pt) {
    const reservation = await resolvePortalToken(pt);
    if (reservation?.clientId) {
      await openGuestSession(reservation.clientId);
      return NextResponse.redirect(new URL(accountPath, req.url));
    }
    return NextResponse.redirect(new URL(`${accountPath}?error=link`, req.url));
  }

  return NextResponse.redirect(new URL(accountPath, req.url));
}
