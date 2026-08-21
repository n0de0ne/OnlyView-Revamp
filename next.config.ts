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
    // Legacy PHP URLs → new routes (SEO: preserve link equity from the old site)
    const map: Array<[string, string]> = [
      ["/index.php", "/"],
      ["/gallery.php", "/gallery"],
      ["/pricing.php", "/rates"],
      ["/contact.php", "/contact"],
      ["/faq.php", "/faq"],
      ["/about.php", "/about"],
      ["/book-direct.php", "/booking"],
      ["/why-book-direct.php", "/why-book-direct"],
      ["/guestbook.php", "/reviews"],
      ["/map.php", "/location"],
      ["/getting-here.php", "/guide/getting-here"],
      ["/getting-around.php", "/guide/getting-here"],
      ["/best-beaches.php", "/guide/best-beaches"],
      ["/best-restaurants.php", "/guide/best-restaurants"],
      ["/st-barth-guide.php", "/guide"],
      ["/st-barth-seasons.php", "/guide/seasons"],
      ["/pointe-milou.php", "/location"],
      ["/journal.php", "/guide"],
      ["/legal.php", "/legal"],
    ];
    return map.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
