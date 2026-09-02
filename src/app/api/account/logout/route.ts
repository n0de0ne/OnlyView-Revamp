import { NextRequest, NextResponse } from "next/server";
import { guestLogout } from "@/lib/guest-auth";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await guestLogout();
  const locale = req.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
  return NextResponse.redirect(
    siteUrl(locale === "fr" ? "/fr/account" : "/account"),
    { status: 303 }
  );
}
