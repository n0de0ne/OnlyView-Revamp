import { NextRequest, NextResponse } from "next/server";

/**
 * - Public site: EN lives at `/…`, FR at `/fr/…`. Internally both render
 *   through the `[locale]` segment, so `/x` is rewritten to `/en/x`.
 * - `/admin/*` requires the admin session cookie (full validation happens
 *   server-side; this is the fast redirect).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin gate
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasSession = req.cookies.has("ov_admin");
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Locale rewrite for the public site
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/media") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname === "/fr" || pathname.startsWith("/fr/")) {
    return NextResponse.next(); // handled natively by [locale]='fr'
  }

  // `/en/...` should not be reachable directly (canonical is prefix-less)
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = req.nextUrl.clone();
  url.pathname = `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
