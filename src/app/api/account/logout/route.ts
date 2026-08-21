import { NextRequest, NextResponse } from "next/server";
import { guestLogout } from "@/lib/guest-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await guestLogout();
  const locale = req.nextUrl.searchParams.get("locale") === "fr" ? "fr" : "en";
  return NextResponse.redirect(
    new URL(locale === "fr" ? "/fr/account" : "/account", req.url),
    { status: 303 }
  );
}
