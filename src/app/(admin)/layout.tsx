import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontClasses } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Admin — Villa ONLY VIEW", template: "%s — Admin ONLY VIEW" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12324a",
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
