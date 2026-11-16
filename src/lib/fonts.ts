import localFont from "next/font/local";

// Self-hosted (latin subset, variable weight, SIL OFL) so the Docker build
// never depends on Google Fonts answering: a bad response there failed the
// image build in next/font/google.
export const cormorant = localFont({
  src: [
    { path: "../fonts/cormorant-garamond-latin.woff2", weight: "300 700", style: "normal" },
    { path: "../fonts/cormorant-garamond-italic-latin.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const montserrat = localFont({
  src: [{ path: "../fonts/montserrat-latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-montserrat",
  display: "swap",
  adjustFontFallback: "Arial",
});

// Utility labels of the redesign (hours, coordinates, prices, counters):
// a compact monospace against the tall serif — a destination marking, not body text.
export const plexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const fontClasses = `${cormorant.variable} ${montserrat.variable} ${plexMono.variable}`;
