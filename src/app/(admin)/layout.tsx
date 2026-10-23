import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontClasses } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Admin — Villa ONLY VIEW", template: "%s — Admin ONLY VIEW" },
  robots: { index: false, follow: false },
  // its own home-screen app, otherwise the site manifest's start_url "/" wins
  manifest: "/manifest-admin.webmanifest",
  appleWebApp: { capable: true, title: "OV Admin" },
};

export const viewport: Viewport = {
  themeColor: "#12324a",
  viewportFit: "cover",
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={fontClasses}>
      <body className="admin-body">{children}</body>
    </html>
  );
}
