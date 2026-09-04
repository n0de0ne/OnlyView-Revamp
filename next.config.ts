import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 640, 828, 1080, 1400, 1800, 2200],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async redirects() {
    // Legacy PHP URLs → new routes (SEO: preserve link equity from the old
    // site). The old site served every page at a clean path (/pricing) *and*
    // at its file name (/pricing.php); both were indexed, both must land.
    const legacy: Array<[string, string]> = [
      ["/index", "/"],
      ["/gallery", "/gallery"],
      ["/pricing", "/rates"],
      ["/contact", "/contact"],
      ["/faq", "/faq"],
      ["/about", "/villa"],
      ["/book-direct", "/booking"],
      ["/why-book-direct", "/why-book-direct"],
      ["/guestbook", "/reviews"],
      ["/map", "/map"],
      ["/getting-here", "/guide/getting-here"],
      ["/getting-around", "/map"],
      ["/best-beaches", "/guide/best-beaches"],
      ["/best-restaurants", "/guide/best-restaurants"],
      ["/activities", "/guide"],
      ["/st-barth-guide", "/guide"],
      ["/st-barth-seasons", "/guide/seasons"],
      ["/st-barth-events", "/guide/seasons"],
      ["/pointe-milou", "/location"],
      ["/villa-use-cases", "/villa"],
      ["/villa-vs-hotel", "/why-book-direct"],
      ["/honeymoon-st-barth", "/villa"],
      ["/family-villa-st-barth", "/villa"],
      ["/wedding-destination", "/villa"],
      ["/groups", "/villa"],
      ["/christmas-new-year", "/rates"],
      ["/concierge-experiences", "/why-book-direct"],
      ["/private-chef", "/guide/best-restaurants"],
      ["/yacht-charters", "/guide/best-beaches"],
      ["/favorites", "/guide"],
      ["/journal", "/guide"],
      ["/legal", "/legal"],
    ];
    const legacyRedirects = legacy.flatMap(([from, to]) => [
      ...(from !== to ? [{ source: from, destination: to, permanent: true }] : []),
      { source: `${from}.php`, destination: to, permanent: true },
    ]);
    // the old site switched language with ?lang=fr on the same URL — those
    // French URLs are what Google indexed; they now live under /fr. The
    // query string rides along on the legacy redirects above, so
    // /pricing.php?lang=fr → /rates?lang=fr → /fr/rates.
    const frQuery = [{ type: "query" as const, key: "lang", value: "fr" }];
    // Contracts already sent for signature point at /sign-contract.php?t=TOKEN.
    // The token is carried over by the migration unchanged, so the old link has
    // to land on the new path — a client with a pending contract must not meet
    // a 404 the day we switch. Not permanent: these are transient app links.
    const signToken = { type: "query" as const, key: "t", value: "(?<token>[A-Za-z0-9_-]+)" };
    const contractRedirects = ["/sign-contract.php", "/sign-contract"].flatMap((source) => [
      {
        source,
        has: [signToken, ...frQuery],
        destination: "/fr/contracts/sign/:token",
        permanent: false,
      },
      { source, has: [signToken], destination: "/contracts/sign/:token", permanent: false },
    ]);
    // The legacy guest portal opened on a URL token (/guest/?t=…); here the
    // guest area is behind a login (magic link), so the token cannot be
    // honoured — old portal links land on that login instead of a 404.
    const guestRedirects = ["/guest", "/guest/:path*", "/guest-app/:path*"].map((source) => ({
      source,
      destination: "/account",
      permanent: false,
    }));
    return [
      // one host: www → apex, so links and signals never split across two
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.onlyviewstbarth.com" }],
        destination: "https://onlyviewstbarth.com/:path*",
        permanent: true,
      },
      // before the generic ?lang=fr rule, which would otherwise swallow them
      ...contractRedirects,
      ...guestRedirects,
      ...legacyRedirects,
      { source: "/", has: frQuery, destination: "/fr", permanent: true },
      {
        source: "/:path((?!fr(?:/|$)|admin|api|_next|media).*)",
        has: frQuery,
        destination: "/fr/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
